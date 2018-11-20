// Connect to Heroku database
const { Client } = require('pg');

// Require logging dependency
const LOGGER = require('../util/logger');

// Get environment variable
const DATABASE_URL = process.env.DATABASE_URL;


// Get current user's ID by OktaID
exports.getUserIdByOktaId = (req, res, next) => {
	// Get Client
	const client = new Client({
		connectionString: DATABASE_URL,
		ssl: true,
	});

	// Connect
	client.connect();

	// Get User ID
	const USER_OKTA_ID = req.user.id;
	client.query(`SELECT id FROM USERS WHERE oktaId=($1);`, [USER_OKTA_ID], (err, resp) => {
		// Check if error occured
		if(err || !resp) {
			// Display internal error
			LOGGER.error(`ERROR: Error while getting user ID with oktaId = ${USER_OKTA_ID}`, err);
			res.status(503);

			// End connection
			client.end();

			return res.redirect('/error');
		}

		let matchingUsers = JSON.parse(JSON.stringify(resp.rows));
		if(matchingUsers != null && matchingUsers.length == 1 && matchingUsers[0].id != null) {
			// Get the ID
			req.userID = matchingUsers[0].id;

			// End connection
			client.end();

			return next();
		}
		else {
			// Display internal error
			LOGGER.error(`ERROR: Multiple users found for oktaId = ${USER_OKTA_ID}`, 'Multiple users for ID');
			res.status(503);

			// End connection
			client.end();

			return res.redirect('/error');
		}
	});
};


// Get current user's statistics
exports.getCurrentUserStatistics = (req, res, next) => {
	// Get Client
	const client = new Client({
		connectionString: DATABASE_URL,
		ssl: true,
	});

	// Connect
	client.connect();

	// Get User Data
	const USER_OKTA_ID = req.user.id;
	client.query(`SELECT USERS.id, USERS.displayName, COUNT(GAMES.id) AS games, SUM(CASE WHEN USERS.oktaId = GAMES.winner THEN 1 ELSE 0 END) AS wins, SUM(CASE WHEN USERS.oktaId != GAMES.winner THEN 1 ELSE 0 END) AS losses FROM USERS LEFT JOIN GAMES ON USERS.oktaId = GAMES.player1 OR USERS.oktaId = GAMES.player2 WHERE USERS.oktaId = ($1) GROUP BY USERS.id,USERS.displayName;`, [USER_OKTA_ID], (err, resp) => {
		// Check if error occured
		if(err || !resp) {
			// Display internal error
			LOGGER.error(`ERROR: Error while accessing user data with oktaId = ${USER_OKTA_ID}`, err);
			res.status(503);

			// End connection
			client.end();

			return res.redirect('/error');
		}

		// Check that either zero or one user is returned
		let matchingUsers = JSON.parse(JSON.stringify(resp.rows));
		if(matchingUsers == null || matchingUsers.length > 1) {
			// Display internal error
			LOGGER.error(`ERROR: Multiple users found for oktaId = ${USER_OKTA_ID}`, 'Multiple users for ID');
			res.status(503);

			// End connection
			client.end();

			return res.redirect('/error');
		}
		else if(matchingUsers.length == 0) {
			// Try to add this user (in case user just signed up)
			LOGGER.debug(`Attempting to insert user ${req.user.displayName} with oktaId = ${USER_OKTA_ID} into the database.`);
			client.query(`INSERT INTO USERS(oktaId,displayName) VALUES(($1),($2)) RETURNING *;`, [USER_OKTA_ID, req.user.displayName], (err, resp) => {
				// End connection
				client.end();

				// Check if error occured
				if(err || !resp) {
					// Internal error
					LOGGER.error(`ERROR: Error while accessing user data with oktaId = ${USER_OKTA_ID}`, err);
					res.status(503);
					return res.redirect('/error');
				}

				// Check that exactly one user is returned
				matchingUsers = JSON.parse(JSON.stringify(resp.rows));
				if(matchingUsers == null || matchingUsers.length != 1) {
					// Internal error
					LOGGER.error(`ERROR: Either zero or multiple users found for oktaId = ${USER_OKTA_ID}`, 'Zero or Multiple Users for ID.');
					res.status(503);
					return res.redirect('/error');
				}

				// Store user statistics
				const user = matchingUsers[0];
				LOGGER.debug(`Successfully inserted user ${user.displayname} with id = ${user.id} into the database.`);
				req.user.displayName = user.displayname;
				req.user.statistics = {
					games: user.games,
					wins: user.wins,
					losses: user.losses
				};

				// Continue
				return next();
			});
		}
		else {
			// Store user statistics
			const user = matchingUsers[0];
			req.user.displayName = user.displayname;
			req.user.statistics = {
				games: user.games,
				wins: user.wins,
				losses: user.losses
			};

			// End connection
			client.end();

			// Continue
			return next();
		}
	});
};


// Get statistics of a user with given ID
exports.getUserStatisticsByID = (req, res, next) => {
	// Get Client
	const client = new Client({
		connectionString: DATABASE_URL,
		ssl: true,
	});

	// Connect
	client.connect();

	// Get User Data
	const userID = req.params.userId;
	client.query(`SELECT USERS.id, USERS.displayName, COUNT(GAMES.id) AS games, SUM(CASE WHEN USERS.oktaId = GAMES.winner THEN 1 ELSE 0 END) AS wins, SUM(CASE WHEN USERS.oktaId != GAMES.winner THEN 1 ELSE 0 END) AS losses FROM USERS LEFT JOIN GAMES ON USERS.oktaId = GAMES.player1 OR USERS.oktaId = GAMES.player2 WHERE USERS.id = ($1) GROUP BY USERS.id,USERS.displayName;`, [userID], (err, resp) => {
		// Check if error occured
		if(err || !resp) {
			// Display internal error
			LOGGER.error(`ERROR: Error while accessing user data with id = ${userID}`, err);
			res.status(503);

			// End connection
			client.end();

			return res.redirect('/error');
		}

		// Check that either zero or one user is returned
		let matchingUsers = JSON.parse(JSON.stringify(resp.rows));
		if(matchingUsers == null || matchingUsers.length > 1) {
			// Display internal error
			LOGGER.error(`ERROR: Multiple users found for id = ${userID}`, 'Multiple users for ID');
			res.status(503);

			// End connection
			client.end();

			return res.redirect('/error');
		}

		// Get user statistics
		let userStatistics = null;
		if(matchingUsers.length == 1) {
			// Store user statistics
			const user = matchingUsers[0];
			userStatistics = {
				displayName: user.displayname,
				games: user.games,
				wins: user.wins,
				losses: user.losses
			};
		}
		req.userStatistics = userStatistics;

		// End connection
		client.end();

		// Continue
		return next();
	});
};


// Get statistics of all existing users
exports.getAllUsersStatistics = (req, res, next) => {
	// Get Client
	const client = new Client({
		connectionString: DATABASE_URL,
		ssl: true,
	});

	// Connect
	client.connect();

	// Get All Users' Data
	client.query(`SELECT USERS.id, USERS.displayName, COUNT(GAMES.id) AS games, SUM(CASE WHEN USERS.oktaId = GAMES.winner THEN 1 ELSE 0 END) AS wins, SUM(CASE WHEN USERS.oktaId != GAMES.winner THEN 1 ELSE 0 END) AS losses FROM USERS LEFT JOIN GAMES ON USERS.oktaId = GAMES.player1 OR USERS.oktaId = GAMES.player2 GROUP BY USERS.id,USERS.displayName;`, (err, resp) => {
		// Check if error occured
		if(err || !resp) {
			// Log internal error
			LOGGER.error(`ERROR: Error while getting all users' data`, err);
			req.allUsersStatistics = null;
		}
		else {
			req.allUsersStatistics = JSON.parse(JSON.stringify(resp.rows));
		}

		// End connection
		client.end();

		return next();
	});
};