// Store logging constants
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const LOG_LEVEL = {
	ERROR: 'ERROR',
	DEBUG: 'DEBUG'
};
Object.freeze(LOG_LEVEL);


// Prepare logging message with proper format
function prepareLogMessage(message, level) {
	const now = new Date();
	const logMessage = {
		timeMillis: now.getTime(),
		level: level,
		message: now.toISOString() + ' - ' + message
	};
	return IS_PRODUCTION ? JSON.stringify(logMessage) : logMessage;
}

// Log message
exports.debug = function debug(message) {
	if(process.env.NODE_ENV === 'test') { return; } // No logging for 'test' environment

	const formattedMessage = prepareLogMessage(message, LOG_LEVEL.DEBUG);
	console.log(formattedMessage);
};

// Log error message (with details if applicable)
exports.error = function error(errMessage, errDetails = '') {
	if(process.env.NODE_ENV === 'test') { return; } // No logging for 'test' environment

	const formattedDetails = (typeof(errDetails) === 'object' ? JSON.stringify(errDetails) : errDetails);
	const message = `${errMessage}, error = ${formattedDetails}`;
	const formattedMessage = prepareLogMessage(message, LOG_LEVEL.ERROR);
	console.error(formattedMessage);
};
