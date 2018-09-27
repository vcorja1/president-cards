// Require all dependencies
const express = require('express');
const app = express();

const passport = require('passport');

// Login logic
app.use('/login', passport.authenticate('oidc'));

// Redirect logic on callback
app.use('/authorization-code/callback',
	passport.authenticate('oidc', { failureRedirect: '/logout' }),
	(req, res) => {
		let redirectionUrl;
		if(req.session != null && req.session.redirectUrl != null) {
			// Reset redirect route to '/dashboard' by default
			redirectionUrl = req.session.redirectUrl;
			req.session.redirectUrl = '/dashboard';
		}
		else {
			redirectionUrl = '/dashboard';
		}
		res.redirect(redirectionUrl);
	}
);

// Logout logic
app.get('/logout', (req, res) => {
	req.logout();
	req.session.destroy();
	res.redirect('/');
});

module.exports = app;