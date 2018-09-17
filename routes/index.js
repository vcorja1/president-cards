// Require all dependencies
const express = require('express');
const app = express();

// GET response for '/'
app.get('/', function(req, res) {
	res.send('Welcome to the President Card Game!');
});

module.exports = app;