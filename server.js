// Set up environment variables (unless in production)
if (process.env.NODE_ENV !== 'production') {
	require('dotenv').config();
}

// Require all dependencies
const express = require('express');
const app = express();
const compression = require('compression');
const helmet = require('helmet');

// Compress all responses
app.use(compression());

// Use Helmet to protect from some well-known web vulnerabilities by setting HTTP headers appropriately
app.use(helmet());

// Connect all routes for the application
const routes = require('./routes');
app.use('/', routes);

// Start the server
const PORT = process.env.PORT || 9090;
app.listen(PORT, function() {
	console.log(`Listening on port: ${PORT}`);
});
