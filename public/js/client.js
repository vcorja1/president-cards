/* jshint -W117 */

(function($) {
	$(function() { // DOM Ready

		/* ------------------ Define constants. ------------------- */
		const VALID_GAME_PARAMETERS = ['gameFinished', 'youWon', 'lossReason', 'yourHand', 'opponentHandCount', 'opponentName', 'yourTurn', 'lastMove', 'moveCount', 'timeRemaining'];
		const VALID_HAND_REGEX = /^\[(([1-4]\d|50|51|\d)(,([1-4]\d|50|51|\d)){0,21})?\]$/g;
		const VALID_MOVE_REGEX = /^\[([1-4]\d|50|51|\d)(,([1-4]\d|50|51|\d)){0,3}\]$/g;


		/* --------------- Set up socket and timer. --------------- */
		let socket;
		let game = null;
		const SECOND = 1000;
		const START_TIME = 45 * SECOND;		// 45 seconds
		let timer = null;
		let timeRemaining = START_TIME;

		// Connect to the IO socket
		socket = io.connect();
		socket.on('connect', function() {
			// Join an existing or a new game
			emitJoinGame();
		});

		socket.on('abort', function() {
			// Game was aborted
			gameWasAborted();
			if(timer != null) {
				clearInterval(timer);
			}
			socket.disconnect();
		});

		socket.on('setup', function(gameDetails) {
			// Set up the game
			if(isValidGame(gameDetails)) {
				gameDetails.gameFinished ? gameFinished(gameDetails) : updateCanvas(gameDetails);
				timeRemaining = game.timeRemaining * SECOND;
				timer = setInterval(onTick, SECOND);

				// TO-DO: Remove testing stuff below
				console.log(gameDetails);
			}
		});

		socket.on('move', function(gameDetails) {
			// Update game
			if(isValidGame(gameDetails)) {
				gameDetails.gameFinished ? gameFinished(gameDetails) : updateCanvas(gameDetails);
				clearInterval(timer);
				if(!gameDetails.gameFinished) {
					timeRemaining = START_TIME;
					timer = setInterval(onTick, SECOND);
				}

				// TO-DO: Remove testing stuff below
				console.log(gameDetails);
			}
		});

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
			$('#countdownTimer').text(`Time to play a hand or to pass:   ${START_TIME / SECOND} seconds`);
			$('#endGameButton').text(game.moveCount < 2 ? 'Abort Game' : 'Resign Game');
		}

		function onTick() {
			if(timeRemaining != null && !isNaN(timeRemaining)) {
				timeRemaining -= SECOND;
				if(timeRemaining <= 0) {
					clearInterval(timer);
					timeRemaining = 0;
				}
				$('#countdownTimer').text(`Time to play a hand or to pass:   ${timeRemaining / SECOND} seconds`);
			}
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
		function emitJoinGame() {
			socket.emit('join');
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
				!isNaN(gameDetails.lossReason) && gameDetails.lossReason >= 0 && gameDetails.lossReason <= 2 &&
				(JSON.stringify(gameDetails.yourHand)).match(VALID_HAND_REGEX) != null &&
				!isNaN(gameDetails.opponentHandCount) && gameDetails.opponentHandCount >= 0 && gameDetails.opponentHandCount <= 22 &&
				typeof gameDetails.opponentName === 'string' &&
				typeof gameDetails.yourTurn === 'boolean' &&
				(gameDetails.lastMove == null || (JSON.stringify(gameDetails.lastMove)).match(VALID_MOVE_REGEX) != null) &&
				!isNaN(gameDetails.moveCount) && gameDetails.moveCount >= 0 && gameDetails.moveCount <= 150 &&
				!isNaN(gameDetails.timeRemaining) && gameDetails.timeRemaining >= 0 && gameDetails.timeRemaining <= (START_TIME / SECOND);
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