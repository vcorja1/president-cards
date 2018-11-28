/* jshint -W082 */
/* jshint -W117 */

(function($) {
	$(function() { // DOM Ready

		/* ------------------ Get game details. ------------------- */
		const jsonGame = $('#jsonGame').val();
		if(jsonGame != null) {
			/* ------------------ Define variables. ------------------- */
			const gameDetails = JSON.parse(jsonGame);
			const player1StartHand = gameDetails.player1StartHand.replace(/\"/g, '').replace('{', '[').replace('}', ']');
			const player2StartHand = gameDetails.player2StartHand.replace(/\"/g, '').replace('{', '[').replace('}', ']');
			const shouldProcessPassedCards = gameDetails.passedCards != null;
			const moves = JSON.parse(gameDetails.moves);
			const movesCount = moves.length;

			let currMove = 0;
			let processedPassedCards = !shouldProcessPassedCards;
			let passedCards = null;
			if(gameDetails.passedCards != null) {
				passedCards = JSON.parse(gameDetails.passedCards.replace(/\"/g, '').replace('{', '[').replace('}', ']'));
			}
			let lastMove = null;
			let player1Hand = JSON.parse(player1StartHand);
			let player2Hand = JSON.parse(player2StartHand);
			let player1Turn = player1Hand[0] < player2Hand[0];

			drawPlayer1Hand();
			drawLastMove();
			drawPlayer2Hand();


			/* --------------- Bind Button Click Events. --------------- */
			$('#nextButton').click(function(event) {
				event.preventDefault();

				if(!$('#nextButton').hasClass('disabled') && currMove >= 0 && currMove < movesCount) {
					if(currMove == 0 && shouldProcessPassedCards && !processedPassedCards) {
						if(player1Hand.includes(passedCards[0])) {
							player1Hand.push(player2Hand.pop());
							player1Hand.push(player2Hand.pop());
							player1Hand = player1Hand.filter( (crd) => !passedCards.includes(crd) );
							player1Hand = player1Hand.sort( (a,b) => a - b );

							player2Hand.push(passedCards[0]);
							player2Hand.push(passedCards[1]);
							player2Hand = player2Hand.sort( (a,b) => a - b );
						}
						else {
							player2Hand.push(player1Hand.pop());
							player2Hand.push(player1Hand.pop());
							player2Hand = player2Hand.filter( (crd) => !passedCards.includes(crd) );
							player2Hand = player2Hand.sort( (a,b) => a - b );

							player1Hand.push(passedCards[0]);
							player1Hand.push(passedCards[1]);
							player1Hand = player1Hand.sort( (a,b) => a - b );
						}
						drawPlayer1Hand();
						drawPlayer2Hand();
						player1Turn = player1Hand[0] < player2Hand[0];
						processedPassedCards = true;
					}
					else {
						lastMove = moves[currMove];
						if(lastMove != 'pass') {
							if(player1Turn) {
								player1Hand = player1Hand.filter( (crd) => !lastMove.includes(crd) );
								drawPlayer1Hand();
							}
							else {
								player2Hand = player2Hand.filter( (crd) => !lastMove.includes(crd) );
								drawPlayer2Hand();
							}
						}
						drawLastMove();

						currMove++;
						player1Turn = !player1Turn;
						if(currMove == movesCount) {
							$('#nextButton').addClass('disabled');
						}
					}

					$('#prevButton').removeClass('disabled');
				}
				else {
					$('#nextButton').addClass('disabled');
				}
			});

			$('#prevButton').click(function(event) {
				event.preventDefault();

				if(!$('#prevButton').hasClass('disabled') && currMove >= 0 && currMove <= movesCount) {
					if(currMove == 0) {
						if(shouldProcessPassedCards && processedPassedCards) {
							player1Hand = JSON.parse(player1StartHand);
							player2Hand = JSON.parse(player2StartHand);
							drawPlayer1Hand();
							drawPlayer2Hand();
							processedPassedCards = false;
						}
						$('#prevButton').addClass('disabled');
					}
					else {
						currMove--;
						player1Turn = !player1Turn;
						lastMove = moves[currMove];
						if(lastMove != 'pass') {
							if(player1Turn) {
								for(const card of lastMove) {
									player1Hand.push(card);
								}
								player1Hand = player1Hand.sort( (a,b) => a - b );
								drawPlayer1Hand();
							}
							else {
								for(const card of lastMove) {
									player2Hand.push(card);
								}
								player2Hand = player2Hand.sort( (a,b) => a - b );
								drawPlayer2Hand();
							}
						}

						if(currMove == 0)  {
							if(!shouldProcessPassedCards) {
								$('#prevButton').addClass('disabled');
							}
							lastMove = null;
						}
						else {
							lastMove = moves[currMove - 1];
						}
						drawLastMove();
					}

					$('#nextButton').removeClass('disabled');
				}
				else {
					$('#prevButton').addClass('disabled');
				}
			});


			/* --------------- Redraw Canvas Functions. --------------- */
			function drawPlayer1Hand() {
				$('#player1Container').empty();
				if(player1Hand != null) {
					for (const card of player1Hand) {
						$('#player1Container').append(getCardElement(card));
					}
				}
			}

			function drawLastMove() {
				$('#lastMoveContainer').empty();
				if(lastMove != null && lastMove != 'pass') {
					for (const card of lastMove) {
						$('#lastMoveContainer').append(getCardElement(card));
					}
				}
			}

			function drawPlayer2Hand() {
				$('#player2Container').empty();
				if(player2Hand != null) {
					for (const card of player2Hand) {
						$('#player2Container').append(getCardElement(card));
					}
				}
			}

			function getCardElement(card) {
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

				return `<li><div class="card ${cardElement.suit} rank-${cardElement.rank}"><span class="rank">${cardElement.rankDisplay}</span><span class="suit">&${cardElement.suit};</span></div></li>`;
			}
		}
	});
})(jQuery);