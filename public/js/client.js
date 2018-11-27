/* jshint -W117 */

(function($) {
	$(function() { // DOM Ready

		/* ------------------ Define constants. ------------------- */
		const VALID_GAME_PARAMETERS = ['gameFinished', 'youWon', 'lossReason', 'yourHand', 'opponentHandCount', 'opponentName', 'yourTurn', 'passingTrash', 'lastMove', 'moveCount', 'timeRemaining'];
		const VALID_HAND_REGEX = /^\[(([1-4]\d|50|51|\d)(,([1-4]\d|50|51|\d)){0,21})?\]$/g;
		const VALID_MOVE_REGEX = /^\[([1-4]\d|50|51|\d)(,([1-4]\d|50|51|\d)){0,3}\]$/g;
		const VALID_PASSING_TRASH_REGEX = /^\[([1-4]\d|50|51|\d),([1-4]\d|50|51|\d)\]$/g;


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

		socket.on('alreadyPlaying', function() {
			socket.disconnect();
			gameAlreadyPlaying();
		});

		socket.on('setup', function(gameDetails) {
			// Set up the game
			if(isValidGame(gameDetails)) {
				gameDetails.gameFinished ? gameFinished(gameDetails) : updateCanvas(gameDetails);
				timeRemaining = game.timeRemaining * SECOND;
				timer = setInterval(onTick, SECOND);
			}
		});

		socket.on('abort', function() {
			// Game was aborted
			socket.disconnect();
			gameWasAborted();
			if(timer != null) {
				clearInterval(timer);
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
			}
		});

		socket.on('rematchCancelled', function() {
			// Game rematch offer was cancelled
			socket.disconnect();
			if(timer != null) {
				clearInterval(timer);
			}
			rematchCancelled(true);
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
				let move = game.passingTrash ? getTrashToPass() : getMoveIfValid();
				if(move != null) {
					emitPlayMove(move);
				}
				else {
					$('#invalidMessageContainer').removeClass('hidden').addClass('visible');
				}

				// Unselect all selected cards
				$('.selected').each(function() {
					$(this).removeClass('selected');
				});
			}
		});

		$('#passButton').click(function(event) {
			event.preventDefault();
			if(game != null && game.yourTurn && game.lastMove != null) {
				emitPlayMove('pass');
			}
		});

		$('#rematchButton').click(function(event) {
			event.preventDefault();
			if(game != null && game.gameFinished) {
				emitRematchRequest();
				rematchCancelled(false);
			}
		});

		$('#yourHandContainer').on('click', '.card', function(event) {
			if($(this).hasClass('selected')) {
				$(this).removeClass('selected');
			}
			else if(!$(this).hasClass('back') && $('.selected').length <= 3) {
				$(this).addClass('selected');
			}
		});


		/* --------------- Redraw Canvas Events. --------------- */
		function gameAlreadyPlaying() {
			game = null;
			$('#status').text('Game Already In Progress');
			$('#alreadyPlayingContainer').removeClass('hidden').addClass('visible');
			$('#gameContainer').removeClass('visible').addClass('hidden');
			$('#abortContainer').removeClass('visible').addClass('hidden');
		}

		function gameWasAborted() {
			game = null;
			$('#status').text('Game Was Aborted');
			$('#alreadyPlayingContainer').removeClass('visible').addClass('hidden');
			$('#gameContainer').removeClass('visible').addClass('hidden');
			$('#abortContainer').removeClass('hidden').addClass('visible');
		}

		function updateCanvas(gameDetails) {
			game = gameDetails;
			if(game.yourTurn) {
				if(game.passingTrash) {
					$('#status').text('Select 2 Cards To Pass To Your Opponent');
				}
				else {
					$('#status').text('Your Turn');
				}
				$('#moveButton').removeClass('disabled').addClass('active');
				if(game.lastMove != null) {
					$('#passButton').removeClass('disabled').addClass('active');
				}
				else {
					$('#passButton').removeClass('active').addClass('disabled');
				}
			}
			else {
				$('#status').text(game.passingTrash ? 'Waiting For Your Opponent To Choose 2 Cards To Pass To You' : 'Waiting For Your Opponent\'s Turn');
				$('#moveButton').removeClass('active').addClass('disabled');
				$('#passButton').removeClass('active').addClass('disabled');
			}
			$('#opponentName').text(gameDetails.opponentName);
			drawOpponentHand(gameDetails.opponentHandCount);
			drawLastMove(gameDetails.lastMove);
			drawYourHand(gameDetails.yourHand);
			$('#invalidMessageContainer').removeClass('visible').addClass('hidden');
			$('#countdownTimerContainer').removeClass('hidden').addClass('visible');
			$('#countdownTimer').text(`Time to play a hand or to pass:   ${START_TIME / SECOND} seconds`);
			$('#gameButtonsContainer').removeClass('hidden').addClass('visible');
			$('#endGameButton').text(game.moveCount < 2 ? 'Abort Game' : 'Resign Game');
			$('#newGameButtonsContainer').removeClass('visible').addClass('hidden');
		}

		function drawOpponentHand(handCount) {
			$('#opponentHandContainer').empty();
			if(handCount != null) {
				for (let i = 0; i < handCount; i++) {
					$('#opponentHandContainer').append('<li><div class="card back"></div></li>');
				}
			}
		}

		function drawLastMove(moves) {
			$('#lastMoveContainer').empty();
			if(moves != null) {
				for (const card of moves) {
					$('#lastMoveContainer').append(getCardElement(card, true));
				}
			}
		}

		function drawYourHand(hand) {
			$('#yourHandContainer').empty();
			if(hand != null) {
				for (const card of hand) {
					$('#yourHandContainer').append(getCardElement(card, false));
				}
			}
		}

		function getCardElement(card, isLastMove) {
			let cardElement = {
				rank: null,
				rankDisplay: null,
				suit: null
			};

			// Get the suit
			switch(card % 4) {
				case 0:
					cardElement.suit = 'clubs';
					break;
				case 1:
					cardElement.suit = 'diams';
					break;
				case 2:
					cardElement.suit = 'hearts';
					break;
				default:
					cardElement.suit = 'spades';
					break;
			}

			// Get the rank
			const calculatedRank = Math.floor(card / 4);
			switch(calculatedRank) {
				case 0:
				case 1:
				case 2:
				case 3:
				case 4:
				case 5:
				case 6:
				case 7:
					cardElement.rank = 3 + calculatedRank;
					cardElement.rankDisplay = 3 + calculatedRank;
					break;
				case 8:
					cardElement.rank = 'j';
					cardElement.rankDisplay = 'J';
					break;
				case 9:
					cardElement.rank = 'q';
					cardElement.rankDisplay = 'Q';
					break;
				case 10:
					cardElement.rank = 'k';
					cardElement.rankDisplay = 'K';
					break;
				case 11:
					cardElement.rank = 'a';
					cardElement.rankDisplay = 'A';
					break;
				default:
					cardElement.rank = 2;
					cardElement.rankDisplay = 2;
					break;
			}

			const lastMoveClass = isLastMove ? ' last-move' : '';
			return `<li><div class="card ${cardElement.suit} rank-${cardElement.rank}${lastMoveClass}"><span class="rank">${cardElement.rankDisplay}</span><span class="suit">&${cardElement.suit};</span></div></li>`;
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
			game = gameDetails;
			$('#status').text(gameDetails.youWon ? 'Congratulations! You won!' : 'Sorry, you lost.');
			drawOpponentHand(gameDetails.opponentHandCount);
			drawLastMove(gameDetails.lastMove);
			drawYourHand(gameDetails.yourHand);
			$('#invalidMessageContainer').removeClass('visible').addClass('hidden');
			$('#countdownTimerContainer').removeClass('visible').addClass('hidden');
			$('#gameButtonsContainer').removeClass('visible').addClass('hidden');
			$('#rematchButton').removeClass('disabled').addClass('active');
			$('#newGameButtonsContainer').removeClass('hidden').addClass('visible');
		}

		function rematchCancelled(rematchRequestCancelled) {
			if(rematchRequestCancelled) {
				game = null;
				$('#status').text('Rematch Request Cancelled.');
			}
			else {
				$('#status').text('Rematch Requested...');
			}
			$('#rematchButton').removeClass('active').addClass('disabled');
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

		function emitRematchRequest() {
			socket.emit('rematch');
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
				typeof gameDetails.passingTrash === 'boolean' &&
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

		function getTrashToPass() {
			let move = null;

			// Validate list of cards
			const playedMove = getSelectedCards();
			if(playedMove != null && playedMove.match(VALID_PASSING_TRASH_REGEX) != null) {
				// Process selected cards
				const cardList = JSON.parse(playedMove).sort( (a,b) => a - b );

				if(cardList[0] != cardList[1] && game.yourHand.includes(cardList[0]) && game.yourHand.includes(cardList[1])) {
					move = playedMove;
				}
			}

			return move;
		}

		function getMoveIfValid() {
			let move = null;

			// Validate list of cards
			const playedMove = getSelectedCards();
			if(playedMove != null && playedMove.match(VALID_MOVE_REGEX) != null) {
				// Process selected cards
				const cardList = JSON.parse(playedMove).sort( (a,b) => a - b );

				// Check all cards are of the same rank and ensure that all cards are different
				const sameRank = ((cardList[cardList.length - 1] - cardList[0]) <= 3) && (Math.floor(cardList[cardList.length - 1] / 4) == Math.floor(cardList[0] / 4));
				if(sameRank && new Set(cardList).size === cardList.length) {
					// Check player contains all cards
					let containsAllCards = true;
					for(const card of game.yourHand) {
						if(!game.yourHand.includes(card)) {
							containsAllCards = false;
							break;
						}
					}

					if(containsAllCards) {
						// Check that the first card played is the smallest one
						let correctFirstMove = true;
						if(game.moveCount === 0 && game.yourHand[0] != cardList[0]) {
							correctFirstMove = false;
						}
						// Check same length as previous move and better than previous move
						if(correctFirstMove && (game.lastMove == null || (game.lastMove.length === cardList.length && Math.max(...game.lastMove) < Math.max(...cardList)))) {
							move = playedMove;
						}
					}
				}
			}

			return move;
		}

		function getSelectedCards() {
			let selectedCards = [];

			$('.selected').each(function() {
				let rank = null;
				let suit = null;

				if($(this).hasClass('rank-3')) { rank = 0; }
				else if($(this).hasClass('rank-4')) { rank = 1; }
				else if($(this).hasClass('rank-5')) { rank = 2; }
				else if($(this).hasClass('rank-6')) { rank = 3; }
				else if($(this).hasClass('rank-7')) { rank = 4; }
				else if($(this).hasClass('rank-8')) { rank = 5; }
				else if($(this).hasClass('rank-9')) { rank = 6; }
				else if($(this).hasClass('rank-10')) { rank = 7; }
				else if($(this).hasClass('rank-j')) { rank = 8; }
				else if($(this).hasClass('rank-q')) { rank = 9; }
				else if($(this).hasClass('rank-k')) { rank = 10; }
				else if($(this).hasClass('rank-a')) { rank = 11; }
				else if($(this).hasClass('rank-2')) { rank = 12; }

				if($(this).hasClass('clubs')) { suit = 0; }
				else if($(this).hasClass('diams')) { suit = 1; }
				else if($(this).hasClass('hearts')) { suit = 2; }
				else if($(this).hasClass('spades')) { suit = 3; }

				if(rank != null && suit != null) {
					selectedCards.push(rank * 4 + suit);
				}
			});

			return selectedCards.length === 0 ? null : JSON.stringify(selectedCards);
		}

	});
})(jQuery);