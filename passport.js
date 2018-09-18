// Require all dependencies
const express = require('express');
const app = express();

const passport = require('passport');
const OidcStrategy = require('passport-openidconnect').Strategy;

app.use(passport.initialize());
app.use(passport.session());

passport.use(
	'oidc',
	new OidcStrategy(
		{
			issuer: `${process.env.OKTA_URL}/oauth2/default`,
			authorizationURL: 'https://{yourOktaDomain}/oauth2/default/v1/authorize',
			tokenURL: 'https://{yourOktaDomain}/oauth2/default/v1/token',
			userInfoURL: 'https://{yourOktaDomain}/oauth2/default/v1/userinfo',
			clientID: process.env.OKTA_CLIENT_ID,
			clientSecret: process.env.OKTA_CLIENT_SECRET,
			callbackURL: `${process.env.APP_BASE_URL}/authorization-code/callback`,
			scope: 'openid profile'
		},
		(issuer, sub, profile, accessToken, refreshToken, done) => {
			return done(null, profile);
		}
	)
);

passport.serializeUser((user, next) => {
	next(null, user);
});

passport.deserializeUser((obj, next) => {
	next(null, obj);
});

module.exports = app;