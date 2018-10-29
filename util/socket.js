// Require logging dependency
const LOGGER = require('../util/logger');

// Set up socket
exports.setUpSocket = function(server) {
	const io = require('socket.io')(server);

	io.on('connection', function(client) {  
		LOGGER.debug('Client connected...');

		client.on('join', function(data) {
			LOGGER.debug(data);
		});
	});

	// io.on('connect', function(){ console.log('connect'); });
	// io.on('event', function(data){ console.log('event'); });
	// io.on('disconnect', function(){ console.log('disconnect'); });

};