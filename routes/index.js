// Require all dependencies
const express = require('express');
const app = express();

// Add middleware to ensure that user is logged in
function ensureLoggedIn(req, res, next) {
	if (req.isAuthenticated()) {
		return next();
	}

	req.session.redirectUrl = req.path;
	res.redirect('/login');
}

// Add authentication middleware
const authentication = require('./authentication');
app.use('/', authentication);

// GET response for '/dashboard'
const { getUserStatistics } = require('../middleware/dashboard');
app.get('/dashboard', [ensureLoggedIn, getUserStatistics], (req, res) => {
	res.render('dashboard', {
		title: 'Dashboard | President Card Game',
		user: req.user
	});
});

// GET response for '/statistics'
const { getAllUsersStatistics } = require('../middleware/statistics');
app.get('/statistics', [ensureLoggedIn, getAllUsersStatistics], (req, res) => {
	res.render('statistics', {
		title: 'Statistics | President Card Game',
		allStatistics: req.allStatistics
	});
});

// GET response for '/'
app.get('/', function(req, res) {
	res.render('index', {
		title: 'Home Page | President Card Game'
	});
});

module.exports = app;