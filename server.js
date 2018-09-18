// Set up environment variables (unless in production)
if (process.env.NODE_ENV !== 'production') {
	require('dotenv').config();
}

// Require all dependencies
const express = require('express');
const app = express();

// Compress all responses
const compression = require('compression');
app.use(compression());

// Use Helmet to protect from some well-known web vulnerabilities by setting HTTP headers appropriately
const helmet = require('helmet');
app.use(helmet());

// Add Body Parser for POST requests
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Set up the template engine
app.set('views',  __dirname + '/views');
app.set('view engine', 'pug');

// Use public folder to serve all static files
const publicFolderPath = __dirname + '/public';
app.use(express.static( publicFolderPath ));

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
app.use(session({
	secret: process.env.COOKIE_SECRET,
	resave: false,
	saveUninitialized: true,
	store: new MemoryStore({
		checkPeriod: 24 * 60 * 60 * 1000	// Prune expired entries every 24 hours
    })
}));

// Set up Passport
const passportSetup = require('./passport');
app.use(passportSetup);

// Connect all routes for the application
const routes = require('./routes');
app.use('/', routes);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
	console.log(`Listening on port: ${PORT}`);
});
