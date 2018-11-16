/* jshint -W117 */

(function($) {
	$(function() { // DOM Ready

		/* --------------- Set up socket. --------------- */
		let socket;
		let game = null;

		// Get userID and validate
		const userID = $('#userID').val();
		const validUserIdRegex = /^[1-9]\d{18}$/g;
		if(userID != null && validUserIdRegex.test(userID)) {
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
				}
			});

			socket.on('move', function(gameDetails) {
				// Update game
				if(isValidGame(gameDetails)) {
					gameDetails.gameFinished ? gameFinished(gameDetails) : updateCanvas(gameDetails);
				}
			});

			socket.on('resign', function(gameDetails) {
				if(isValidGame(gameDetails) && gameDetails.gameFinished) {
					gameFinished(gameDetails);

					// TO-DO: Remove logging below
					console.log('Game was resigned');
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
					updateCanvas(game);
					$('#invalidMessageContainer').removeClass('hidden').addClass('visible');
				}
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

			// TO-DO: Remove testing stuff below
			console.log(gameDetails);
		}

		function gameFinished(gameDetails) {
			$('#status').text(gameDetails.youWon ? 'Congratulations! You won!' : 'You lost.');
			$('#opponentHandCount').text(gameDetails.opponentHandCount);
			$('#lastMove').text(gameDetails.lastMove || 'RESIGNED');
			$('#yourHand').text(JSON.stringify(gameDetails.yourHand));
			$('#invalidMessageContainer').removeClass('visible').addClass('hidden');
			$('#gameButtonsContainer').removeClass('visible').addClass('hidden');
			$('#newGameButtonsContainer').removeClass('hidden').addClass('visible');

			// TO-DO: Remove testing stuff below
			console.log(gameDetails);
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
			// TO-DO: Validate Game Object
			return gameDetails != null;
		}

		function getMoveIfValid() {
			let move = null;

			// TO-DO: Validate move on press
			const validMoveRegex = /^\[(\d|[1-4]\d|5[01]])(,([1-9]|[1-4]\d|50|51)){0,3}\]$/g;
			const playedMove = $('#testInput').val();
			$('#testInput').val('');
			if(playedMove != null && validMoveRegex.test(playedMove)) {
				// TO-DO: Check same rank
				// TO-DO: Check same length as previous move
				// TO-DO: Check contains cards in hand

				move = playedMove;
			}

			return move;
		}

	});
})(jQuery);