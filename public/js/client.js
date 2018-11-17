/* jshint -W117 */

(function($) {
	$(function() { // DOM Ready

		/* --------------- Define constants. --------------- */
		const VALID_USER_ID_REGEX = /^[1-9]\d{18}$/g;
		const VALID_GAME_PARAMETERS = ['gameFinished', 'youWon', 'yourHand', 'opponentHandCount', 'opponentName', 'yourTurn', 'lastMove', 'moveCount'];
		const VALID_HAND_REGEX = /^\[((\d|[1-4]\d|50|51)(,(\d|[1-4]\d|50|51)){0,21})?\]$/g;
		const VALID_MOVE_REGEX = /^\[(\d|[1-4]\d|50|51)(,(\d|[1-4]\d|50|51)){0,3}\]$/g;


		/* --------------- Set up socket. --------------- */
		let socket;
		let game = null;

		// Get userID and validate
		const userID = $('#userID').val();
		if(userID != null && VALID_USER_ID_REGEX.test(userID)) {
			// Connect to the IO socket
			socket = io.connect();
			socket.on('connect', function() {
				// Join an existing or a new game
				emitJoinGame(userID);
			});

			socket.on('abort', function() {
				// Game was aborted
				gameWasAborted();
				socket.disconnect();
			});

			socket.on('setup', function(gameDetails) {
				// Set up the game
				if(isValidGame(gameDetails)) {
					gameDetails.gameFinished ? gameFinished(gameDetails) : updateCanvas(gameDetails);

					// TO-DO: Remove testing stuff below
					console.log(gameDetails);
				}
			});

			socket.on('move', function(gameDetails) {
				// Update game
				if(isValidGame(gameDetails)) {
					gameDetails.gameFinished ? gameFinished(gameDetails) : updateCanvas(gameDetails);

					// TO-DO: Remove testing stuff below
					console.log(gameDetails);
				}
			});

			socket.on('resign', function(gameDetails) {
				if(isValidGame(gameDetails) && gameDetails.gameFinished) {
					gameFinished(gameDetails);

					// TO-DO: Remove testing stuff below
					console.log(gameDetails);
				}
			});
		}


		/* --------------- Bind Button Click Events. --------------- */
		$('#endGameButton').click(function(event) {
			event.preventDefault();
			if(game == null || (game.moveCount != null && game.moveCount < 2)) {
				emitAbortGame();
			}
			else {
				emitResignGame();
			}
		});

		$('#moveButton').click(function(event) {
			event.preventDefault();
			if(game != null && game.yourTurn) {
				let move = getMoveIfValid();
				if(move != null) {
					emitPlayMove(move);
				}
				else {
					$('#invalidMessageContainer').removeClass('hidden').addClass('visible');
				}
				updateCanvas(game);
			}
		});

		$('#passButton').click(function(event) {
			event.preventDefault();
			if(game != null && game.yourTurn && game.lastMove != null) {
				emitPlayMove('pass');
			}
		});


		/* --------------- Redraw Canvas Events. --------------- */
		function gameWasAborted() {
			game = null;
			$('#status').text('Game was aborted');
			$('#gameContainer').removeClass('visible').addClass('hidden');
			$('#invalidMessageContainer').removeClass('visible').addClass('hidden');
			$('#abortContainer').removeClass('hidden').addClass('visible');
		}

		function updateCanvas(gameDetails) {
			game = gameDetails;
			if(game.yourTurn) {
				$('#status').text('Your Turn');
				$('#moveButton').removeClass('disabled').addClass('active');
				$('#moveButton').prop('disabled', false);
				if(game.lastMove != null) {
					$('#passButton').removeClass('disabled').addClass('active');
					$('#passButton').prop('disabled', false);
				}
				else {
					$('#passButton').removeClass('active').addClass('disabled');
					$('#passButton').prop('disabled', true);
				}
			}
			else {
				$('#status').text('Waiting For Your Opponent\'s Turn');
				$('#moveButton').removeClass('active').addClass('disabled');
				$('#moveButton').prop('disabled', true);
				$('#passButton').removeClass('active').addClass('disabled');
				$('#passButton').prop('disabled', true);
			}
			$('#opponentHandCount').text(gameDetails.opponentHandCount);
			$('#lastMove').text(gameDetails.lastMove || 'PASS');
			$('#yourHand').text(JSON.stringify(gameDetails.yourHand));
			$('#invalidMessageContainer').removeClass('visible').addClass('hidden');
			$('#endGameButton').text(game.moveCount < 2 ? 'Abort Game' : 'Resign Game');
		}

		function gameFinished(gameDetails) {
			$('#status').text(gameDetails.youWon ? 'Congratulations! You won!' : 'Sorry, you lost.');
			$('#opponentHandCount').text(gameDetails.opponentHandCount);
			$('#lastMove').text(gameDetails.lastMove || 'RESIGNED');
			$('#yourHand').text(JSON.stringify(gameDetails.yourHand));
			$('#invalidMessageContainer').removeClass('visible').addClass('hidden');
			$('#gameButtonsContainer').removeClass('visible').addClass('hidden');
			$('#newGameButtonsContainer').removeClass('hidden').addClass('visible');
		}


		/* --------------- Socket Emission Events. --------------- */
		function emitJoinGame(userId) {
			socket.emit('join', userId);
		}

		function emitAbortGame() {
			socket.emit('abort');
			socket.disconnect();
			gameWasAborted();
		}

		function emitPlayMove(move) {
			socket.emit('move', move);
		}

		function emitResignGame() {
			socket.emit('resign');
		}


		/* --------------- Validation Functions. --------------- */
		function isValidGame(gameDetails) {
			return gameDetails != null &&
				areArraysEqual(VALID_GAME_PARAMETERS, Object.keys(gameDetails)) &&
				typeof gameDetails.gameFinished === 'boolean' &&
				(gameDetails.youWon == null || typeof gameDetails.youWon === 'boolean') &&
				VALID_HAND_REGEX.test(JSON.stringify(gameDetails.yourHand)) &&
				!isNaN(gameDetails.opponentHandCount) && gameDetails.opponentHandCount >= 0 && gameDetails.opponentHandCount <= 22 &&
				typeof gameDetails.opponentName === 'string' &&
				typeof gameDetails.yourTurn === 'boolean' &&
				(gameDetails.lastMove == null || VALID_MOVE_REGEX.test(gameDetails.lastMove)) &&
				!isNaN(gameDetails.moveCount) && gameDetails.moveCount >= 0 && gameDetails.moveCount <= 150;
		}

		function areArraysEqual(a, b) {
			if (a === b) { return true; }
			if (a == null || b == null) { return false; }
			if (a.length != b.length) { return false; }
			for (let i = 0; i < a.length; ++i) {
				if (a[i] !== b[i]) { return false; }
			}
			return true;
		}

		function getMoveIfValid() {
			let move = null;

			// TO-DO: Use actual cards here
			const playedMove = $('#testInput').val();
			$('#testInput').val('');

			// Validate list of cards
			if(playedMove != null && VALID_MOVE_REGEX.test(playedMove)) {
				// Process selected cards
				const cardList = JSON.parse(playedMove).sort();

				// Check all cards are of the same rank
				const sameRank = ((cardList[cardList.length - 1] - cardList[0]) <= 3) && (Math.floor(cardList[cardList.length - 1] / 4) == Math.floor(cardList[0] / 4));
				if(sameRank) {
					// Check player contains all cards
					let containsAllCards = true;
					for(const card of game.yourHand) {
						if(!game.yourHand.includes(card)) {
							containsAllCards = false;
							break;
						}
					}

					if(containsAllCards) {
						// Check same length as previous move and better than previous move
						if(game.lastMove == null || (game.lastMove.length === cardList.length && Math.max(...game.lastMove) < Math.max(...cardList))) {
							move = playedMove;
						}
					}
				}
			}

			return move;
		}

	});
})(jQuery);