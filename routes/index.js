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
app.get('/dashboard', ensureLoggedIn, (req, res) => {
	res.render('dashboard', {
		title: 'Dashboard | President Card Game',
		user: req.user
	});
});

// GET response for '/'
app.get('/', function(req, res) {
	res.render('index', {
		title: 'Home Page | President Card Game'
	});
});

module.exports = app;