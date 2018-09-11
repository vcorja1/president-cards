// Require all dependencies
const express = require('express');
const app = express();

// Connect all routes for the application
app.get('/', function(req, res) {
	res.send('Welcome to the President Card Game!');
});

// Start the server
const PORT = process.env.PORT || 9090;
app.listen(PORT, function() {
	console.log(`Listening on port: ${PORT}`);
});
