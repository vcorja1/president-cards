// Connect to Heroku database
const { Client } = require('pg');

// Require logging dependency
const LOGGER = require('../util/logger');

// Get environment variable
const DATABASE_URL = process.env.DATABASE_URL;


// Get all games of current user
exports.getCurrentUserGames = (req, res, next) => {
	return getUserGames(req.user.id, true, req, res, next);
};

// Get all completed games of a specific user
exports.getSpecificUserGames = (req, res, next) => {
	return getUserGames(req.params.userId, false, req, res, next);
};

// Get games from the database
function getUserGames(userId, searchByOktaId, req, res, next) {
	// Get Client
	const client = new Client({
		connectionString: DATABASE_URL,
		ssl: true,
	});

	// Connect
	client.connect();

	// Prepare SQL query
	const whereFilter = searchByOktaId ? 'WHERE' : 'WHERE winner IS NOT NULL AND';
	const idFilter = searchByOktaId ? 'U1.oktaId = ($1) OR U2.oktaId = ($1)' : 'U1.id = ($1) OR U2.id = ($1)';

	// Get All Relevant Games
	client.query(`SELECT GAMES.id AS gameId, winner, U1.oktaId AS player1_ID, U1.displayName AS player1, U2.displayName AS player2 FROM GAMES, USERS U1, USERS U2 ${whereFilter} player1 = U1.oktaId AND player2 = U2.oktaId AND (${idFilter}) ORDER BY GAMES.id DESC;`, [userId], (err, resp) => {
		// Check if error occured
		if(err || !resp) {
			// Log internal error
			LOGGER.error(`ERROR: Error while getting games of user with oktaId = ${userId}`, err);
			req.gameHistory = null;
		}
		else {
			req.gameHistory = [];
			req.ongoingGameId = null;

			const gameHistory = JSON.parse(JSON.stringify(resp.rows));
			for (const game of gameHistory) {
				if (game.winner == null) {
					// Only consider ongoing games if getting data for dashboard
					if(searchByOktaId) {
						if(req.ongoingGame != null) {
							LOGGER.error(`ERROR: Found multiple ongoing games for user with oktaId = ${userId}`, 'Multiple ongoing games.');
						}
						req.ongoingGameId = game.gameid;
					}
				}
				else {
					// Format Game Details
					const player1Won = game.winner == game.player1_id;
					const gameDetails = {
						winner: player1Won ? game.player1 : game.player2,
						loser: player1Won ? game.player2 : game.player1,
						gameId: game.gameid
					};
					// Add To Array Of Completed Games
					req.gameHistory.push(gameDetails);
				}
			}
		}

		// End connection
		client.end();

		return next();
	});
}

// Get game by ID
exports.getGameById = (req, res, next) => {
	const id = req.params.gameId;

	// Validate input, should be in range of 1 to 2147483647
	const validSerialRegex = /^[1-9]\d{0,9}$/g;
	if(id != null && validSerialRegex.test(id) && id <= 2147483647) {
		// Get Client
		const client = new Client({
			connectionString: DATABASE_URL,
			ssl: true,
		});

		// Connect
		client.connect();

		// Get All Completed Games
		client.query(`SELECT GAMES.id AS gameId, winner, prevGameId, passedCards, moves, U1.oktaId AS player1_ID, U1.displayName AS player1, U2.oktaId AS player2_ID, U2.displayName AS player2 FROM GAMES, USERS U1, USERS U2 WHERE GAMES.id=($1) AND player1 = U1.oktaId AND player2 = U2.oktaId;`, [id], (err, resp) => {
			// End connection
			client.end();

			// Check if error occured
			let gameDetails;

			if(err || !resp) {
				// Log internal error
				LOGGER.error(`ERROR: Error while getting games with id = ${id}`, err);
				gameDetails = null;
			}
			else {
				const matchedGames = JSON.parse(JSON.stringify(resp.rows));

				if(matchedGames == null || matchedGames.length > 1) {
					// Internal error
					LOGGER.error(`ERROR: Multiple games found for id = ${id}`, 'Multiple Games for ID.');
					res.status(503);
					return res.redirect('/error');
				}
				else if(matchedGames.length == 1) {
					// Check if game is over or is still ongoing
					const game = matchedGames[0];
					if(game.winner != null) {
						const player1Won = game.winner == game.player1_id;
						gameDetails = {
							finished: true,
							winner: player1Won ? game.player1 : game.player2,
							loser: player1Won ? game.player2 : game.player1,
							gameId: game.gameid,
							prevGameId: game.prevGameId,
							passedCards: game.passedCards,
							player1StartHand: game.player1StartHand,
							player2StartHand: game.player2StartHand,
							moves: game.moves
						};
					}
					else if(game.player1_id == req.user.id || game.player2_id == req.user.id) {
						// Otherwise allow user to continue the ongoing game if he is a part of it
						gameDetails = {
							finished: false,
							gameId: game.gameid,
							prevGameId: game.prevGameId,
							passedCards: game.passedCards,
							player1StartHand: game.player1StartHand,
							player2StartHand: game.player2StartHand,
							player1CurHand: game.player1CurHand,
							player2CurHand: game.player2CurHand,
							moves: game.moves
						};
					}
				}
			}

			// Store the game details
			req.gameDetails = gameDetails;

			return next();
		});

	}
	else {
		req.gameDetails = null;
		return next();
	}
};

// Get all completed games
exports.getAllCompletedGames = (req, res, next) => {
	// Get Client
	const client = new Client({
		connectionString: DATABASE_URL,
		ssl: true,
	});

	// Connect
	client.connect();

	// Get All Completed Games
	client.query(`SELECT GAMES.id AS gameId, winner, U1.oktaId AS player1_ID, U1.displayName AS player1, U2.displayName AS player2 FROM GAMES, USERS U1, USERS U2 WHERE winner IS NOT NULL AND player1 = U1.oktaId AND player2 = U2.oktaId ORDER BY GAMES.id DESC;`, (err, resp) => {
		// Check if error occured
		if(err || !resp) {
			// Log internal error
			LOGGER.error(`ERROR: Error while getting all completed games`, err);
			req.completedGames = null;
		}
		else {
			req.completedGames = [];
			const completedGames = JSON.parse(JSON.stringify(resp.rows));
			for (const game of completedGames) {
				// Format Game Details
				const player1Won = game.winner == game.player1_id;
				const gameDetails = {
					winner: player1Won ? game.player1 : game.player2,
					loser: player1Won ? game.player2 : game.player1,
					gameId: game.gameid
				};
				// Add To Array Of Completed Games
				req.completedGames.push(gameDetails);
			}
		}

		// End connection
		client.end();

		return next();
	});
};
