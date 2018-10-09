// Require all dependencies
const express = require('express');
const app = express();

const PAGE_TITLE_POSTFIX = ' | President Card Game';

// Add middleware to ensure that user is logged in
function ensureLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}

	req.session.redirectUrl = req.path;
	return res.redirect('/login');
}

// Add authentication middleware
const authentication = require('./authentication');
app.use('/', authentication);

// GET response for '/dashboard'
const { getCurrentUserStatistics } = require('../middleware/statistics');
const { getCurrentUserGames } = require('../middleware/games');
app.get('/dashboard', [ensureLoggedIn, getCurrentUserStatistics, getCurrentUserGames], (req, res, next) => {
	try {
		res.render('dashboard', {
			title: 'Dashboard' + PAGE_TITLE_POSTFIX,
			user: {
				displayName: req.user.displayName,
				games: req.user.statistics.games,
				wins: req.user.statistics.wins,
				losses: req.user.statistics.losses
			}
		});
	}
	catch (err) {
		return next(err);
	}
});

// GET response for '/statistics'
const { getAllUsersStatistics } = require('../middleware/statistics');
app.get('/statistics', [ensureLoggedIn, getAllUsersStatistics], (req, res, next) => {
	try {
		res.render('statistics', {
			title: 'Statistics' + PAGE_TITLE_POSTFIX,
			allUsersStatistics: req.allUsersStatistics
		});
	}
	catch (err) {
		return next(err);
	}
});

// GET response for '/games'
const { getAllCompletedGames } = require('../middleware/games');
app.get('/games', [ensureLoggedIn, getAllCompletedGames], (req, res, next) => {
	try {
		res.render('games', {
			title: 'Games' + PAGE_TITLE_POSTFIX,
			completedGames: req.completedGames
		});
	}
	catch (err) {
		return next(err);
	}
});

// GET response for '/'
app.get('/', function(req, res, next) {
	try {
		res.render('index', {
			title: 'Home Page' + PAGE_TITLE_POSTFIX
		});
	}
	catch (err) {
		return next(err);
	}
});

// The 404 route
app.get('*', function(req, res, next) {
	try {
		res.render('error', {
			title: 'Page Not Found' + PAGE_TITLE_POSTFIX
		});
	}
	catch (err) {
		return next(err);
	}
});

module.exports = app;