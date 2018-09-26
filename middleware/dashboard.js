exports.getUserStatistics = (req, res, next) => {
	// TODO: Change from fake statistics to actual ones
	if(req.user != null) {
		req.user.statistics = [
			{ name: 'Games', value: 0 },
			{ name: 'Wins', value: 0 },
			{ name: 'Losses', value: 0 }
		];
	}

	return next();
};