// Require all dependencies
const express = require('express');
const app = express();

const passport = require('passport');

// Login logic
app.use('/login', passport.authenticate('oidc'));

// Redirect logic on callback
app.use('/authorization-code/callback',
	passport.authenticate('oidc', { failureRedirect: '/error' }),
	(req, res) => {
		res.redirect(req.session.redirectUrl || '/');
	}
);

// Logout logic
app.get('/logout', (req, res) => {
	req.logout();
	req.session.destroy();
	res.redirect('/');
});

module.exports = app;