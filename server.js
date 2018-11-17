// Set up environment variables (unless in production)
const NODE_ENV = process.env.NODE_ENV;
if (NODE_ENV !== 'production') {
	require('dotenv').config();
}

// Require all dependencies
const express = require('express');
const app = express();

// Set app name
app.locals.siteName = 'President Card Game';

// Compress all responses
const compression = require('compression');
app.use(compression());

// Use Helmet to protect from some well-known web vulnerabilities by setting HTTP headers appropriately
const helmet = require('helmet');
app.use(helmet({
	contentSecurityPolicy: { directives: { defaultSrc: ["'self'"] } },
	referrerPolicy: { policy: 'no-referrer' }
}));

// Add Feature-Policy security header
const featurePolicy = require('feature-policy');
app.use(featurePolicy({
	features: {
		geolocation: ["'none'"],
		midi: ["'none'"],
		notifications: ["'none'"],
		push: ["'none'"],
		syncXhr: ["'none'"],
		microphone: ["'none'"],
		camera: ["'none'"],
		magnetometer: ["'none'"],
		gyroscope: ["'none'"],
		speaker: ["'none'"],
		vibrate: ["'none'"],
		fullscreen: ["'none'"],
		payment: ["'none'"]
	}
}));

// Remove X-Powered-By header
app.use(function(req, res, next) {
	res.removeHeader('X-Powered-By');
	return next();
});

// Use HTTPS enforcer to handle non-encrypted HTTP requests
if(NODE_ENV === 'production') {
	const enforce = require('express-sslify');
	app.use(enforce.HTTPS({ trustProtoHeader: true }));
}

// Add logger for requests and reponses
// const morgan = require('morgan');
// app.use(morgan('dev'));

// Add Body Parser for POST requests
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set up the template engine
app.set('views',  __dirname + '/views');
app.set('view engine', 'pug');

// Use public folder to serve all static files
const publicFolderPath = __dirname + '/public';
app.use(express.static( publicFolderPath, { dotfiles: 'allow' } ));

// Add stylus for more expressive CSS, and use Nib
const stylus = require('stylus');
const nib = require('nib');

function compile(str, path) {
	return stylus(str)
		.set('filename', path)
		.set('compress', true)
		.use(nib());
}

app.use(
	stylus.middleware(
		{
			src: publicFolderPath,
			compile: compile
		}
	)
);

// Add session details to keep cookies safe from compromise
app.set('trust proxy', 1);

const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const sessionStore = new MemoryStore({
	checkPeriod: 24 * 60 * 60 * 1000	// Prune expired entries every 24 hours
});
app.use(session({
	key: 'express.sid',
	secret: process.env.COOKIE_SECRET,
	resave: false,
	saveUninitialized: true,
	store: sessionStore
}));

// Set up Passport
const passportSetup = require('./util/passport');
app.use(passportSetup);

// Connect all routes for the application
const routes = require('./routes');
app.use('/', routes);

// Start the server
let server = null;
if(NODE_ENV === 'production') {
	const http = require('http');
	server = http.createServer(app);
}
else {
	const fs = require('fs');
	const options = {
		key: fs.readFileSync('./public/certs/cert.key'),
		cert: fs.readFileSync('./public/certs/cert.crt')
	};

	const https = require('https');
	server = https.createServer(options, app);
}

const socket = require('./util/socket');
socket.setUpSocket(server, sessionStore);

const PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
	console.log(`Listening on port: ${PORT}`);
});
