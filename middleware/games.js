// Connect to Heroku database
const { Client } = require('pg');

// Require logging dependency
const LOGGER = require('../util/logger');

// Get environment variable
const DATABASE_URL = process.env.DATABASE_URL;

// Store constants
const VALID_GAME_PARAMETERS = ['id', 'player1', 'player2', 'player1Name', 'player2Name', 'player1Room', 'player2Room', 'room', 'needsPlayer', 'canAbort', 'gameFinished', 'winner', 'lossReason', 'player1Turn', 'player1Cards', 'player1StartingCards', 'player2Cards', 'player2StartingCards', 'moves', 'timeRemaining', 'lastMove', 'rematchRequested', 'lastGameId', 'lastGameWinner', 'passedCards'];
const VALID_HAND_REGEX = /^\[(([1-4]\d|50|51|\d)(,([1-4]\d|50|51|\d)){0,21})?\]$/g;
const VALID_MOVES_REGEX = /^\[\[([1-4]\d|50|51|\d)(,([1-4]\d|50|51|\d)){0,3}\](,(\"pass\"|(\[([1-4]\d|50|51|\d)(,([1-4]\d|50|51|\d)){0,3}\]))){1,125}\]$/g;
const VALID_LAST_MOVE_REGEX = /^\[([1-4]\d|50|51|\d)(,([1-4]\d|50|51|\d)){0,3}\]$/g;
const VALID_PASSED_CARDS_REGEX = /^\[([1-4]\d|50|51|\d),([1-4]\d|50|51|\d)\]$/g;

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
		client.query(`SELECT GAMES.id AS gameId, winner, player1StartHand, player2StartHand, lossReason, prevGameId, passedCards, moves, U1.oktaId AS player1_ID, U1.displayName AS player1, U2.oktaId AS player2_ID, U2.displayName AS player2 FROM GAMES, USERS U1, USERS U2 WHERE GAMES.id=($1) AND player1 = U1.oktaId AND player2 = U2.oktaId;`, [id], (err, resp) => {
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
							gameId: game.gameid,
							winner: player1Won ? game.player1 : game.player2,
							loser: player1Won ? game.player2 : game.player1,
							lossReason: game.lossreason,
							player1: game.player1,
							player2: game.player2,
							prevGameId: game.prevgameid,
							passedCards: game.passedcards,
							player1StartHand: game.player1starthand,
							player2StartHand: game.player2starthand,
							moves: game.moves
						};

						switch(gameDetails.lossReason) {
							case 1:
								gameDetails.reason = ' by resignation';
								break;
							case 2:
								gameDetails.reason = ' by timeout';
								break;
							default:
								gameDetails.reason = '';
								break;
						}
					}
					else if(game.player1_id == req.user.id || game.player2_id == req.user.id) {
						// Otherwise allow user to continue the ongoing game if he is a part of it
						return res.redirect('/play');
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

// Save new game
exports.saveNewGame = (game) => {
	if(isValidGame(true, game)) {
		// Get Client
		const client = new Client({
			connectionString: DATABASE_URL,
			ssl: true,
		});

		// Connect
		client.connect();

		// Insert game
		const passedCards = game.passedCards == null ? null : JSON.stringify(game.passedCards);
		client.query(`INSERT INTO GAMES(player1, player2, player1StartHand, player2StartHand, player1CurHand, player2CurHand, moves, player1Turn, prevGameId, passedCards) VALUES(($1),($2),($3),($4),($5),($6),($7),($8),($9),($10)) RETURNING *;`, [game.player1, game.player2, game.player1StartingCards, game.player2StartingCards, game.player1Cards, game.player2Cards, JSON.stringify(game.moves), game.player1Turn, game.lastGameId, passedCards], (err, resp) => {
			// Check if error occured
			if(err || !resp) {
				// Internal error
				LOGGER.error(`ERROR: Error while saving game to database: ${JSON.stringify(game)}`, err);
			}
			else {
				const insertedGame = JSON.parse(JSON.stringify(resp.rows));
				if(insertedGame == null || insertedGame.length != 1) {
					// Internal error
					LOGGER.error(`ERROR: Error while saving game to database: ${JSON.stringify(game)}`, err);
				}
				else {
					game.id = insertedGame[0].id;
					LOGGER.debug(`Successfully inserted game to database with id = '${game.id}': ${JSON.stringify(game)}`);
				}
			}
		});
	}
};

// Update ongoing game
exports.updateGame = (game) => {
	if(isValidGame(false, game)) {
		// Get Client
		const client = new Client({
			connectionString: DATABASE_URL,
			ssl: true,
		});

		// Connect
		client.connect();

		// Update game
		client.query(`UPDATE GAMES SET player1=($1), player2=($2), winner=($3), lossReason=($4), player1StartHand=($5), player2StartHand=($6), player1CurHand=($7), player2CurHand=($8), moves=($9), player1Turn=($10) WHERE id=($11) RETURNING *;`, [game.player1, game.player2, game.winner, game.lossReason, game.player1StartingCards, game.player2StartingCards, game.player1Cards, game.player2Cards, JSON.stringify(game.moves), game.player1Turn, game.id], (err, resp) => {
			// Check if error occured
			if(err || !resp) {
				LOGGER.error(`ERROR: Error while updating game to database: ${JSON.stringify(game)}`, err);
			}
			else {
				const insertedGame = JSON.parse(JSON.stringify(resp.rows));
				if(insertedGame == null || insertedGame.length != 1) {
					LOGGER.error(`ERROR: Error while updating game to database: ${JSON.stringify(game)}`, err);
				}
				else {
					LOGGER.debug(`Successfully updated game to database with id = '${game.id}': ${JSON.stringify(game)}`);
				}
			}
		});
	}
};

// Ensure that game is a valid object
function isValidGame(isNewGame, game) {
	return game != null &&
		areArraysEqual(VALID_GAME_PARAMETERS, Object.keys(game)) &&
		(isNewGame || (game.id != null && !isNaN(game.id) && game.id >= 0 && game.id <= 2147483647)) &&
		typeof game.player1 === 'string' &&
		typeof game.player2 === 'string' &&
		typeof game.player1Name === 'string' &&
		typeof game.player2Name === 'string' &&
		typeof game.player1Room === 'string' &&
		typeof game.player2Room === 'string' &&
		typeof game.room === 'string' &&
		typeof game.needsPlayer === 'boolean' &&
		typeof game.canAbort === 'boolean' &&
		typeof game.gameFinished === 'boolean' &&
		(game.winner == null || typeof game.winner === 'string') &&
		(game.lossReason == null || (!isNaN(game.lossReason) && game.lossReason >= 0 && game.lossReason <= 2)) &&
		typeof game.player1Turn === 'boolean' &&
		(JSON.stringify(game.player1Cards)).match(VALID_HAND_REGEX) != null &&
		(JSON.stringify(game.player1StartingCards)).match(VALID_HAND_REGEX) != null &&
		(JSON.stringify(game.player2Cards)).match(VALID_HAND_REGEX) != null &&
		(JSON.stringify(game.player2StartingCards)).match(VALID_HAND_REGEX) != null &&
		(JSON.stringify(game.moves)).match(VALID_MOVES_REGEX) != null &&
		!isNaN(game.timeRemaining) && game.timeRemaining >= 0 && game.timeRemaining <= 45000 &&
		(game.lastMove == null || (JSON.stringify(game.lastMove)).match(VALID_LAST_MOVE_REGEX) != null) &&
		(game.rematchRequested == null || typeof game.rematchRequested === 'string') &&
		(game.lastGameId == null || (!isNaN(game.lastGameId) && game.lastGameId >= 0 && game.lastGameId <= 2147483647)) &&
		(game.lastGameWinner == null || typeof game.lastGameWinner === 'string') &&
		(game.passedCards == null || (JSON.stringify(game.passedCards)).match(VALID_PASSED_CARDS_REGEX) != null);
}

// Check if two arrays are equal
function areArraysEqual(a, b) {
	if (a === b) { return true; }
	if (a == null || b == null) { return false; }
	if (a.length != b.length) { return false; }
	for (let i = 0; i < a.length; ++i) {
		if (a[i] !== b[i]) { return false; }
	}
	return true;
}
