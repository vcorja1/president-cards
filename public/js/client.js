// Connect to the IO socket
const socket = io.connect();
socket.on('connect', function() {
	socket.emit('join', 'Hello World from client');
});
