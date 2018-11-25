/* jshint -W057 */
/* jshint -W058 */

// Require the necessary packages
const LOGGER = require('./logger');
const passportSocketIo = require('passport.socketio');

// Get access to the database
const { saveNewGame, updateGame } = require('../middleware/games');

// Get environment varibles
const APP_BASE_URL = process.env.APP_BASE_URL;

// Store regexes for validation
const VALID_MOVE_REGEX = /^(pass|\[(\d|[1-4]\d|5[01]])(,([1-9]|[1-4]\d|50|51)){0,3}\])$/g;
const VALID_PASSING_TRASH_REGEX = /^\[([1-4]\d|50|51|\d),([1-4]\d|50|51|\d)\]$/g;

// Store time for valid move and the loss reason object
const SECOND = 1000;
const START_TIME = 45 * SECOND;		// 45 seconds
const LOSS_REASON = {
	EMPTY_DECK: 0,
	RESIGNATION: 1,
	TIMEOUT: 2
};
Object.freeze(LOSS_REASON);

// Store variables
let gameCollection = new function() {
	this.totalGameCount = 0;
	this.gameList = {};
};


// Set up socket
exports.setUpSocket = function(server, sessionStore) {
	const io = require('socket.io')(server);

	io.use(passportSocketIo.authorize({
		cookieParser: require('cookie-parser'),
		key: 'express.sid',
		secret: process.env.COOKIE_SECRET,
		store: sessionStore,
		fail: onAuthorizeFail
	}));

	function onAuthorizeFail(data, message, error, accept) {
		// Allow all unauthenticated users (to support game rooms)
		accept(null, !error);
	}

	// Listen for events when client connected
	io.on('connection', function(client) {

		// Handle event when client wants to join a game
		client.on('join', function() {
			const userID = client.request.user.id;
			const userName = client.request.user.displayName;

			// Get userID and validate
			if(userID != undefined && userID != null && /^[A-Za-z0-9]{20}$/.test(userID)) {
				let joinNewGame = true;

				// Check if user is already playing a game
				// TO-DO: Uncomment code below
				/*Object.entries(gameCollection.gameList).find(([gameID, game]) => {
					if(game.player1 == userID || game.player2 == userID) {
						joinNewGame = false;

						// Pass the setup unless already playing a game
						if(game.player1 == userID) {
							if(game.player1Room != null && game.player1Room != client.id) {
								client.emit('alreadyPlaying');
							}
							else {
								// Notify player about the hand
								game.player1Room = client.id;
								client.emit('setup', getPlayerSetup(true, game));

								// Add player to the room
								client.join(game.room);
							}
						}
						else {
							if(game.player2Room != null && game.player2Room != client.id) {
								client.emit('alreadyPlaying');
							}
							else {
								// Notify player about the hand
								game.player2Room = client.id;
								client.emit('setup', getPlayerSetup(false, game));

								// Add player to the room
								client.join(game.room);
							}
						}
						return true;
					}
				});*/

				// Join a new game that needs another player
				if(joinNewGame) {
					Object.entries(gameCollection.gameList).find(([gameID, game]) => {
						if(game.needsPlayer) {
							joinNewGame = false;
							game.needsPlayer = false;
							game.player2 = 'fakeOktaID'; // TO-DO: use real value -> userID;
							game.player2Name = 'Test Account'; // TO-DO: use real value -> userName;
							game.player2Room = client.id;

							// Get the game deck and save game to database
							const gameDetails = startGame(game);
							LOGGER.debug(`Starting new game in gameRoom = '${gameDetails.room}': ${JSON.stringify(gameDetails)}`);

							// Notify player 1 about the hand
							io.sockets.in(game.room).emit('setup', getPlayerSetup(true, gameDetails));
							// Notify player 2 about the hand
							client.emit('setup', getPlayerSetup(false, gameDetails));

							// Add player 2 to the room
							client.join(game.room);
							return true;
						}
						return false;
					});

					// Otherwise, create a new game
					if(joinNewGame) {
						setUpGameRoom(client, userID, userName);
					}
				}
			}
		});

		// Abort event
		client.on('abort', function() {
			// Notify rooms of abortion
			const connectedRoomIDs = Object.keys(client.rooms);
			for(let i = 0; i < connectedRoomIDs.length; i++) {
				io.to(connectedRoomIDs[i]).emit('abort');
			}
			client.disconnect();
		});

		// Move event
		client.on('move', function(move) {
			let ongoingGame = getOngoingGame();
			if(ongoingGame != null && !ongoingGame.gameFinished) {
				// Check that it is this user's turn
				const isPlayer1 = client.id === ongoingGame.player1Room;
				const isPlayerTurn = client.id === (isPlayer1 ? ongoingGame.player1Room : ongoingGame.player2Room);
				if(isPlayerTurn) {
					if(move != null && ongoingGame.lastGameId != null && ongoingGame.passedCards == null && ongoingGame.moves.length === 0) {
						// Process the trash passed in
						if(move != null && move.match(VALID_PASSING_TRASH_REGEX) != null) {
							// Process cards to transfer
							const cardList = JSON.parse(move).sort( (a,b) => a - b );

							// Check that player contains all cards
							let playerCards = (isPlayer1 ? ongoingGame.player1Cards : ongoingGame.player2Cards);
							if(cardList[0] != cardList[1] && playerCards.includes(cardList[0]) && playerCards.includes(cardList[1])) {
								// Get the 2 best cards from the previous game's losing player
								const otherPlayerCards = (isPlayer1 ? ongoingGame.player2Cards : ongoingGame.player1Cards);
								playerCards.push(otherPlayerCards.pop());
								playerCards.push(otherPlayerCards.pop());

								// Transfer cards to the other player
								otherPlayerCards.push(cardList[0]);
								otherPlayerCards.push(cardList[1]);
								if(isPlayer1) {
									ongoingGame.player1Cards = playerCards.filter( (crd) => !cardList.includes(crd) );
								}
								else {
									ongoingGame.player2Cards = playerCards.filter( (crd) => !cardList.includes(crd) );
								}

								// Sort cards
								ongoingGame.player1Cards.sort( (a,b) => a - b );
								ongoingGame.player2Cards.sort( (a,b) => a - b );

								// Set up the game
								ongoingGame.passedCards = cardList;
								ongoingGame.player1Turn = ongoingGame.player1Cards[0] < ongoingGame.player2Cards[0];

								// Log result
								LOGGER.debug(`Winner passed this trash to loser: '${move}'. Updated game details: ${JSON.stringify(ongoingGame)}`);

								// Notify sockets
								io.to(ongoingGame.player1Room).emit('move', getPlayerSetup(true, ongoingGame));
								io.to(ongoingGame.player2Room).emit('move', getPlayerSetup(false, ongoingGame));
								io.to(ongoingGame.room).emit('move', ongoingGame);
							}
						}
					}
					else if(move != null && move.match(VALID_MOVE_REGEX)) {
						// Process a game move
						let updatedGame = false;
						if(move === 'pass') {
							if(ongoingGame.lastMove != null) {
								ongoingGame.player1Turn = !ongoingGame.player1Turn;
								ongoingGame.moves.push(move);
								ongoingGame.lastMove = null;
								ongoingGame.canAbort = false;
								updatedGame = true;
							}
						}
						else {
							// Process cards passed in
							const cardList = JSON.parse(move).sort( (a,b) => a - b );

							// Check all cards are of the same rank and ensure that all cards are different
							const sameRank = ((cardList[cardList.length - 1] - cardList[0]) <= 3) && (Math.floor(cardList[cardList.length - 1] / 4) == Math.floor(cardList[0] / 4));
							if(sameRank && new Set(cardList).size === cardList.length) {
								// Check that player contains all cards
								const playerCards = (isPlayer1 ? ongoingGame.player1Cards : ongoingGame.player2Cards);
								let containsAllCards = true;
								for(const card of cardList) {
									if(!playerCards.includes(card)) {
										containsAllCards = false;
										break;
									}
								}

								if(containsAllCards) {
									// Check same length as previous move and better than previous move
									if(ongoingGame.lastMove == null || (ongoingGame.lastMove.length === cardList.length && Math.max(...ongoingGame.lastMove) < Math.max(...cardList))) {
										ongoingGame.player1Turn = !ongoingGame.player1Turn;
										ongoingGame.moves.push(cardList);
										ongoingGame.lastMove = cardList;
										ongoingGame.canAbort = ongoingGame.moves.length < 2;

										// Remove cards from player
										if(isPlayer1) {
											ongoingGame.player1Cards = ongoingGame.player1Cards.filter( (crd) => !cardList.includes(crd) );
											ongoingGame.gameFinished = ongoingGame.player1Cards.length === 0;
										}
										else {
											ongoingGame.player2Cards = ongoingGame.player2Cards.filter( (crd) => !cardList.includes(crd) );
											ongoingGame.gameFinished = ongoingGame.player2Cards.length === 0;
										}

										// Check if game finished
										if(ongoingGame.gameFinished) {
											ongoingGame.winner = (isPlayer1 ? ongoingGame.player1 : ongoingGame.player2);
											ongoingGame.lossReason = LOSS_REASON.EMPTY_DECK;
										}

										updatedGame = true;
									}
								}
							}
						}

						if(updatedGame) {
							// Log result
							LOGGER.debug(`New move played: '${move}'. Updated game details: ${JSON.stringify(ongoingGame)}`);

							// Log if game finished
							if(ongoingGame.gameFinished) {
								LOGGER.debug(`Game over (empty deck)! Game won by player with id = '${ongoingGame.winner}'. Final game details: ${JSON.stringify(ongoingGame)}`);
							}

							// Update database
							if(ongoingGame.moves.length == 2) {
								saveNewGame(ongoingGame);
							}
							else if(ongoingGame.moves.length > 2) {
								updateGame(ongoingGame);
							}

							// Notify sockets
							io.to(ongoingGame.player1Room).emit('move', getPlayerSetup(true, ongoingGame));
							io.to(ongoingGame.player2Room).emit('move', getPlayerSetup(false, ongoingGame));
							io.to(ongoingGame.room).emit('move', ongoingGame);
						}
					}
				}
			}
		});

		// Resignation event
		client.on('resign', function() {
			let ongoingGame = getOngoingGame();
			if(ongoingGame != null && !ongoingGame.canAbort && !ongoingGame.gameFinished) {
				const isPlayer1 = client.id === ongoingGame.player1Room;
				ongoingGame.winner = isPlayer1 ? ongoingGame.player2 : ongoingGame.player1;
				ongoingGame.gameFinished = true;
				ongoingGame.lossReason = LOSS_REASON.RESIGNATION;
				LOGGER.debug(`Game over (resignation)! Game won by player with id = '${ongoingGame.winner}'. Final game details: ${JSON.stringify(ongoingGame)}`);

				// Update database
				updateGame(ongoingGame);

				// Notify sockets
				io.to(ongoingGame.player1Room).emit('move', getPlayerSetup(true, ongoingGame));
				io.to(ongoingGame.player2Room).emit('move', getPlayerSetup(false, ongoingGame));
				io.to(ongoingGame.room).emit('move', ongoingGame);
			}
		});

		// Timeout - game lost on time
		client.on('timeout', function() {
			let ongoingGame = gameCollection.gameList[client.id];
			if(ongoingGame != null && ongoingGame.timeRemaining == 0) {
				if(ongoingGame.canAbort) {
					const connectedRoomIDs = Object.keys(client.rooms);
					for(let i = 0; i < connectedRoomIDs.length; i++) {
						io.to(connectedRoomIDs[i]).emit('abort', client.id);
					}
				}
				else {
					ongoingGame.winner = ongoingGame.player1Turn ? ongoingGame.player2 : ongoingGame.player1;
					ongoingGame.gameFinished = true;
					ongoingGame.lossReason = LOSS_REASON.TIMEOUT;
					LOGGER.debug(`Game over (timeout)! Game won by player with id = '${ongoingGame.winner}'. Final game details: ${JSON.stringify(ongoingGame)}`);

					// Update database
					updateGame(ongoingGame);

					// Notify sockets
					io.to(ongoingGame.player1Room).emit('move', getPlayerSetup(true, ongoingGame));
					io.to(ongoingGame.player2Room).emit('move', getPlayerSetup(false, ongoingGame));
					io.to(ongoingGame.room).emit('move', ongoingGame);
				}
			}
		});

		// Rematch event
		client.on('rematch', function() {
			let ongoingGame = getOngoingGame();
			if(ongoingGame == null) {
				client.emit('rematchCancelled');
				client.disconnect();
			}
			else if(ongoingGame.gameFinished) {
				// Process rematch request
				if(ongoingGame.rematchRequested == null) {
					ongoingGame.rematchRequested = client.id;
				}
				else if(ongoingGame.rematchRequested != client.id) {
					// Set up the rematch
					io.to(ongoingGame.room).emit('setupRematchGame');
				}
			}
		});

		// Rematch event - setup is complete
		client.on('rematchSetupComplete', function() {
			const ongoingGame = gameCollection.gameList[client.id];
			if(ongoingGame != null) {
				io.to(ongoingGame.player1Room).emit('setup', getPlayerSetup(true, ongoingGame));
				io.to(ongoingGame.player2Room).emit('setup', getPlayerSetup(false, ongoingGame));
				io.to(ongoingGame.room).emit('setup', ongoingGame);
			}
		});

		// Rematch cancelled
		client.on('rematchCancelled', function() {
			if(gameCollection.gameList[client.id] != null) {
				// Remove game from server storage
				delete gameCollection.gameList[client.id];
				gameCollection.totalGameCount--;
				LOGGER.debug(`Removed gameRoom with ID = '${client.id}' since player doesn\'t want a rematch.`);
			}
		});

		// Listen for disconnection events
		client.on('disconnecting', function() {
			// Notify rooms of leaving
			const connectedRoomIDs = Object.keys(client.rooms);
			for(let i = 0; i < connectedRoomIDs.length; i++) {
				io.to(connectedRoomIDs[i]).emit('playerLeaving', client.id);
			}
		});

		// Get ongoing game
		function getOngoingGame() {
			let ongoingGame = null;
			if(client != null && client.id != null && client.request.user.id != undefined && client.request.user.id != null) {
				Object.entries(gameCollection.gameList).find(([gameID, game]) => {
					if(game.player1Room == client.id || game.player2Room == client.id) {
						ongoingGame = game;
						return true;
					}
				});
			}
			return ongoingGame;
		}

	});

};


// Create new room
function setUpGameRoom(player1Socket, player1ID, player1Name) {
	// Set up (client) gameRoom
	const socketIOClient = require('socket.io-client');
	const gameRoom = socketIOClient.connect(APP_BASE_URL, { secure: true, reconnect: true, rejectUnauthorized: false });

	// Set up countdown timer
	let timer = null;

	// Set up when connected
	gameRoom.on('connect', function() {
		// Create game details
		let gameDetails = {
			id: null,
			player1: player1ID,
			player2: null,
			player1Name: player1Name,
			player2Name: null,
			player1Room: player1Socket.id,
			player2Room: null,
			room: gameRoom.id,
			needsPlayer: true,
			canAbort: true,
			gameFinished: false,
			winner: null,
			lossReason: null,
			player1Turn: true,
			player1Cards: null,
			player1StartingCards: null,
			player2Cards: null,
			player2StartingCards: null,
			moves: [],
			timeRemaining: START_TIME,
			lastMove: null,
			rematchRequested: null,
			lastGameId: null,
			lastGameWinner: null,
			passedCards: null
		};
		gameCollection.gameList[gameRoom.id] = gameDetails;
		gameCollection.totalGameCount++;
		LOGGER.debug(`Created new gameRoom with ID = '${gameRoom.id}'`);

		// Add players to the game
		player1Socket.join(gameRoom.id);
	});

	// Process when a rematch is requested
	gameRoom.on('setupRematchGame', function() {
		const lastGame = gameCollection.gameList[gameRoom.id];
		if(lastGame != null) {
			let newGameDetails = {
				id: null,
				player1: lastGame.player1,
				player2: lastGame.player2,
				player1Name: lastGame.player1Name,
				player2Name: lastGame.player2Name,
				player1Room: lastGame.player1Room,
				player2Room: lastGame.player2Room,
				room: gameRoom.id,
				needsPlayer: false,
				canAbort: true,
				gameFinished: false,
				winner: null,
				lossReason: null,
				player1Turn: lastGame.winner == lastGame.player1,
				player1Cards: null,
				player1StartingCards: null,
				player2Cards: null,
				player2StartingCards: null,
				moves: [],
				timeRemaining: START_TIME,
				lastMove: null,
				rematchRequested: null,
				lastGameId: lastGame.id,
				lastGameWinner: lastGame.winner,
				passedCards: null
			};
			newGameDetails = startGame(newGameDetails);
			newGameDetails.player1Turn = (lastGame.winner == lastGame.player1);
			gameCollection.gameList[gameRoom.id] = newGameDetails;
			LOGGER.debug(`Starting new rematch in gameRoom = '${newGameDetails.room}': ${JSON.stringify(newGameDetails)}`);

			gameRoom.emit('rematchSetupComplete');
		}
	});

	// Process when game is started
	gameRoom.on('setup', function() {
		gameCollection.gameList[gameRoom.id].timeRemaining = START_TIME;
		timer = setInterval(onTick, SECOND);
	});

	// Process every tick
	function onTick() {
		let game = gameCollection.gameList[gameRoom.id];
		if(game != null && game.timeRemaining != null) {
			if(game.gameFinished) {
				clearInterval(timer);
			}
			else {
				game.timeRemaining -= SECOND;
				if(game.timeRemaining <= 0) {
					clearInterval(timer);
					game.timeRemaining = 0;
					gameRoom.emit('timeout');
				}
			}
		}
	}

	// Process when a move is played
	gameRoom.on('move', function() {
		clearInterval(timer);
		let game = gameCollection.gameList[gameRoom.id];
		if(!game.gameFinished) {
			game.timeRemaining = START_TIME;
			timer = setInterval(onTick, SECOND);
		}
	});

	// Process when a user leaves
	gameRoom.on('playerLeaving', function(playerLeaving) {
		let game = gameCollection.gameList[gameRoom.id];
		if(game.player1Room === playerLeaving || game.player2Room == playerLeaving) {
			if(game.needsPlayer) {
				// Remove game from server storage
				delete gameCollection.gameList[gameRoom.id];
				gameCollection.totalGameCount--;
				LOGGER.debug(`Removed gameRoom with ID = '${gameRoom.id}' since player left without playing.`);
				gameRoom.disconnect();
			}
			else if(game.canAbort) {
				// Remove game from server storage
				delete gameCollection.gameList[gameRoom.id];
				gameCollection.totalGameCount--;
				LOGGER.debug(`Removed gameRoom with ID = '${gameRoom.id}' since player left without playing.`);

				// Notify all members about the 'Abort' event
				gameRoom.emit('abort');
				gameRoom.disconnect();
			}
			else if(game.gameFinished) {
				// Notify all members about the rematch cancellation event
				gameRoom.emit('rematchCancelled');
				gameRoom.disconnect();
			}
			else {
				if(game.player1Room === playerLeaving) {
					game.player1Room = null;
				}
				else {
					game.player2Room = null;
				}
			}
		}
	});

	// Process when a user aborts
	gameRoom.on('abort', function(id) {
		// Remove game from server storage
		delete gameCollection.gameList[gameRoom.id];
		gameCollection.totalGameCount--;
		if(gameRoom.id == id) {
			LOGGER.debug(`Removed gameRoom with ID = '${gameRoom.id}' because game was aborted due to timeout.`);
		}
		else {
			LOGGER.debug(`Removed gameRoom with ID = '${gameRoom.id}' because player aborted.`);
		}
		gameRoom.disconnect();
	});

	// Process when the room should be removed
	gameRoom.on('removeRoom', function() {
		// Remove game from server storage
		delete gameCollection.gameList[gameRoom.id];
		gameCollection.totalGameCount--;
		LOGGER.debug(`Removed gameRoom with ID = '${gameRoom.id}' because the game is over.`);
		gameRoom.disconnect();
	});

}


// Start new game
function startGame(game) {
	// Shuffle deck
	let deck = Array.from({ length: 52 }, (v, k) => k);
	for (let i = 51; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[deck[i], deck[j]] = [deck[j], deck[i]];
	}

	// Deal cards
	// TO-DO: Use proper number of cards -> 22
	game.player1StartingCards = deck.slice(0, 4).sort( (a, b) => a - b );
	// game.player1StartingCards = deck.slice(0, 22).sort( (a, b) => a - b );
	game.player1Cards = game.player1StartingCards.slice(0);
	game.player2StartingCards = deck.slice(4, 8).sort( (a, b) => a - b );
	// game.player2StartingCards = deck.slice(22, 44).sort( (a, b) => a - b );
	game.player2Cards = game.player2StartingCards.slice(0);
	game.player1Turn = game.player1Cards[0] < game.player2Cards[0];

	return game;
}


// Get setup for the user
function getPlayerSetup(isPlayer1, gameDetails) {
	let youWon = null;
	if(gameDetails.gameFinished) {
		youWon = isPlayer1 ? (gameDetails.winner == gameDetails.player1) : (gameDetails.winner == gameDetails.player2);
	}
	return {
		gameFinished: gameDetails.gameFinished,
		youWon: youWon,
		lossReason: gameDetails.lossReason,
		yourHand: isPlayer1 ? gameDetails.player1Cards : gameDetails.player2Cards,
		opponentHandCount: isPlayer1 ? gameDetails.player2Cards.length : gameDetails.player1Cards.length,
		opponentName: isPlayer1 ? gameDetails.player2Name : gameDetails.player1Name,
		yourTurn: isPlayer1 ? gameDetails.player1Turn : !gameDetails.player1Turn,
		passingTrash: gameDetails.lastGameId != null && gameDetails.passedCards == null && gameDetails.moves.length === 0,
		lastMove: gameDetails.lastMove,
		moveCount: gameDetails.moves.length,
		timeRemaining: gameDetails.timeRemaining / SECOND
	};
}