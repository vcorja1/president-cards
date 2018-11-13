(function($) {
	$(function() { // DOM Ready

		// Set up socket
		let socket;
		let yourMove = false;

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
				$('#status').text('Game was aborted');;
				$('#gameContainer').removeClass('visible').addClass('hidden');
				$('#abortContainer').removeClass('hidden').addClass('visible');
				socket.disconnect();
			});

			socket.on('setup', function(gameDetails) {
				// Set up the game
				console.log(gameDetails);
				$('#status').text(gameDetails.yourTurn ? 'Your Turn' : 'Waiting For Your Opponent\'s Turn');
				$('#opponentHandCount').text(gameDetails.opponentHandCount);
				$('#yourHand').text(JSON.stringify(gameDetails.yourHand));
			});
		}

		function joinGame(userId) {
			socket.emit('join', userId);
		}

	});
})(jQuery);