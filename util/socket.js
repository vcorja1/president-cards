/* jshint -W057 */
/* jshint -W058 */

// Get logger packer
const LOGGER = require('./logger');

// Get environment varibles
const APP_BASE_URL = process.env.APP_BASE_URL;

// Store variables
let gameCollection = new function() {
	this.totalGameCount = 0;
	this.gameList = {};
};

// Set up socket
exports.setUpSocket = function(server) {
	const io = require('socket.io')(server);

	// Listen for events when client connected
	io.on('connection', function(client) {

		// Handle event when client wants to join a game
		client.on('join', function(userID) {
			// Get userID and validate
			if(userID != null && /^[1-9][\d]{18}$/.test(userID)) {
				let joinNewGame = true;

				// Check if user is already playing a game
				// TO-DO: Uncomment code below
				/*Object.entries(gameCollection.gameList).find(([gameID, game]) => {
					if(game.player1 == userID || game.player2 == userID) {
						joinNewGame = false;

						// Update room ID
						if(game.player1 == userID) {
							game.player1Room = client.id;
						}
						else {
							game.player2Room = client.id;
						}

						// Notify player about the hand
						client.emit('setup', getPlayerSetup(true, userID, game));

						// Add player to the room
						client.join(game.room);
						return true;
					}
				});*/

				// Join a new game that needs another player
				if(joinNewGame) {
					Object.entries(gameCollection.gameList).find(([gameID, game]) => {
						if(game.needsPlayer) {
							joinNewGame = false;
							game.needsPlayer = false;
							game.player2 = '1886027828000982019'; // TO-DO: use real value -> userID;
							game.player2Room = client.id;

							// Get the game deck and save game to database
							const gameDetails = startGame(game);
							LOGGER.debug(`Starting new game with id = '${gameDetails.id}': ${JSON.stringify(gameDetails)}`);

							// Notify player 1 about the hand
							io.sockets.in(game.room).emit('setup', getPlayerSetup(false, userID, gameDetails));
							// Notify player 2 about the hand
							client.emit('setup', getPlayerSetup(true, userID, gameDetails));

							// Add player 2 to the room
							client.join(game.room);
							return true;
						}
						return false;
					});

					// Otherwise, create a new game
					if(joinNewGame) {
						setUpGameRoom(client, userID);
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
		});

		// Move event
		client.on('move', function() {
			// TO-DO: Add move logic
		});

		// Resignation event
		client.on('resign', function() {
			// TO-DO: Add resignation logic
		});

		// Listen for disconnection events
		client.on('disconnecting', function() {
			// Notify rooms of leaving
			const connectedRoomIDs = Object.keys(client.rooms);
			for(let i = 0; i < connectedRoomIDs.length; i++) {
				io.to(connectedRoomIDs[i]).emit('playerLeaving', client.id);
			}
		});

	});

};


// Create new room
function setUpGameRoom(player1Socket, player1ID) {
	const socketIOClient = require('socket.io-client');
	const gameRoom = socketIOClient.connect(APP_BASE_URL, { secure: true, reconnect: true, rejectUnauthorized: false });

	// Set up when connected
	gameRoom.on('connect', function() {
		// Create game details
		let gameDetails = {
			id: null,
			player1: player1ID,
			player2: null,
			player1Name: null,
			player2Name: null,
			player1Room: player1Socket.id,
			player2Room: null,
			room: gameRoom.id,
			needsPlayer: true,
			canAbort: true,
			gameFinished: false,
			player1Turn: true,
			player1Cards: null,
			player2Cards: null,
			moves: [],
			lastMove: null
		};
		gameCollection.gameList[gameRoom.id] = gameDetails;
		gameCollection.totalGameCount++;
		LOGGER.debug(`Created new gameRoom with ID = '${gameRoom.id}'`);

		// Add player 1 to the game
		player1Socket.join(gameRoom.id);
	});

	// Process when a user leaves
	gameRoom.on('playerLeaving', function(playerLeaving) {
		let game = gameCollection.gameList[gameRoom.id];
		if(game.player1Room === playerLeaving || game.player2Room == playerLeaving) {
			if(game.needsPlayer || game.finished) {
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
	gameRoom.on('abort', function() {
		// Remove game from server storage
		delete gameCollection.gameList[gameRoom.id];
		gameCollection.totalGameCount--;
		LOGGER.debug(`Removed gameRoom with ID = '${gameRoom.id}' because player aborted.`);
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
	game.player1Cards = deck.slice(0, 22).sort( (a, b) => a - b );
	game.player2Cards = deck.slice(22, 44).sort( (a, b) => a - b );
	game.player1Turn = game.player1Cards[0] < game.player2Cards[1];

	return game;
}


// Get setup for the user
function getPlayerSetup(gettingForCurrentPlayer, playerID, gameDetails) {
	const isPlayer1 = (gameDetails.player1 == playerID & gettingForCurrentPlayer);
	let youWon = null;
	if(gameDetails.gameFinished) {
		youWon = isPlayer1 ? (gameDetails.winner == gameDetails.player1) : (gameDetails.winner == gameDetails.player2);
	}
	return {
		gameFinished: gameDetails.gameFinished,
		youWon: youWon,
		yourHand: isPlayer1 ? gameDetails.player1Cards : gameDetails.player2Cards,
		opponentHandCount: isPlayer1 ? gameDetails.player2Cards.length : gameDetails.player1Cards.length,
		opponentName: isPlayer1 ? gameDetails.player2Name : gameDetails.player1Name,
		yourTurn: isPlayer1 ? gameDetails.player1Turn : !gameDetails.player1Turn,
		lastMove: gameDetails.lastMove,
		moveCount: gameDetails.moves.length
	};
}