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
	return getUserGames(req.body.id, false, req, res, next);
};

// Get games from the database
function getUserGames(userOktaId, includeIncompleted, req, res, next) {
	// Get Client
	const client = new Client({
		connectionString: DATABASE_URL,
		ssl: true,
	});

	// Connect
	client.connect();

	// Prepare SQL query
	const incompleteFilter = includeIncompleted ? 'WHERE' : 'WHERE winner IS NOT NULL AND';
	const sqlQuery = `SELECT * FROM GAMES ${incompleteFilter} (player1 = ($1) OR player2 = ($1));`;// JOIN USERS ON GAMES.player1 = USERS.oktaId AND JOIN USERS ON GAMES.player2 = USERS.oktaId;`;

	// Get All Relevant Games
	client.query(sqlQuery, [userOktaId], (err, resp) => {
		// Check if error occured
		if(err || !resp) {
			// Log internal error
			LOGGER.error(`ERROR: Error while getting games of user with oktaId = ${userOktaId}`, err);
			req.userGames = null;
		}
		else {
			req.userGames = JSON.parse(JSON.stringify(resp.rows));

			if(includeIncompleted) {
				// Check if there is a game in progress
				req.ongoingGame = null;
				for (let game in req.userGames) {
					if (game.winner == null) {
						req.ongoingGame = game;
						break;
					}
				}
			}
		}

		// End connection
		client.end();

		return next();
	});
}

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
	client.query(`SELECT GAMES.id AS gameId, GAMES.winner AS winner, U1.oktaId AS player1_ID, U1.displayName AS player1, U2.displayName AS player2 FROM GAMES, USERS U1, USERS U2 WHERE winner IS NOT NULL AND player1 = U1.oktaId AND player2 = U2.oktaId;`, (err, resp) => {
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