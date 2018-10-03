// Require all dependencies
const express = require('express');
const app = express();

const passport = require('passport');
const OidcStrategy = require('passport-openidconnect').Strategy;

// Get environment variables
const OKTA_URL = process.env.OKTA_URL;
const OKTA_CLIENT_ID = process.env.OKTA_CLIENT_ID;
const OKTA_CLIENT_SECRET = process.env.OKTA_CLIENT_SECRET;
const APP_BASE_URL = process.env.APP_BASE_URL;

// Use passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Set up passport
passport.use(
	'oidc',
	new OidcStrategy(
		{
			issuer: `${OKTA_URL}/oauth2/default`,
			authorizationURL: `${OKTA_URL}/oauth2/default/v1/authorize`,
			tokenURL: `${OKTA_URL}/oauth2/default/v1/token`,
			userInfoURL: `${OKTA_URL}/oauth2/default/v1/userinfo`,
			clientID: OKTA_CLIENT_ID,
			clientSecret: OKTA_CLIENT_SECRET,
			callbackURL: `${APP_BASE_URL}/authorization-code/callback`,
			scope: 'openid profile'
		},
		(issuer, sub, profile, accessToken, refreshToken, done) => {
			return done(null, profile);
		}
	)
);

passport.serializeUser((user, next) => {
	return next(null, user);
});

passport.deserializeUser((obj, next) => {
	return next(null, obj);
});

module.exports = app;