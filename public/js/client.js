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
				joinGame(userID);
			});

			socket.on('abort', function() {
				// Game was aborted
				gameWasAborted();
			});

			socket.on('setup', function(gameDetails) {
				// Set up the game
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
				abortGame();
			}
			else {
				resignGame();
			}
		});


		$('#moveButton').click(function(event) {
			event.preventDefault();
			if(game != null && game.yourTurn) {
				let move = getMoveIfValid();
				if(move != null) {
					playMove(move);
				}
			}
		});


		/* --------------- Redraw Canvas Events. --------------- */
		function gameWasAborted() {
			game = null;
			$('#status').text('Game was aborted');
			$('#gameContainer').removeClass('visible').addClass('hidden');
			$('#abortContainer').removeClass('hidden').addClass('visible');
		}

		function updateCanvas(gameDetails) {
			game = gameDetails;
			if(game.yourTurn) {
				$('#status').text('Your Turn');
				$('#moveButton').removeClass('disabled').addClass('active');
				$('#moveButton').prop('disabled', false);
			}
			else {
				$('#status').text('Waiting For Your Opponent\'s Turn');
				$('#moveButton').removeClass('active').addClass('disabled');
				$('#moveButton').prop('disabled', true);
			}
			$('#opponentHandCount').text(gameDetails.opponentHandCount);
			$('#yourHand').text(JSON.stringify(gameDetails.yourHand));
			$('#endGameButton').text(game.moveCount < 2 ? 'Abort Game' : 'Resign Game');

			// TO-DO: Remove logging below
			console.log(gameDetails);
		}

		function gameFinished(gameDetails) {
			// TO-DO: Implement

			// TO-DO: Remove logging below
			console.log(gameDetails);
		}


		/* --------------- Socket Emission Events. --------------- */
		function joinGame(userId) {
			socket.emit('join', userId);
		}

		function abortGame() {
			socket.emit('abort');
			socket.disconnect();
			gameWasAborted();
		}

		function playMove(move) {
			socket.emit('move', move);
		}

		function resignGame() {
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

			return move;
		}

	});
})(jQuery);