exports.getAllUsersStatistics = (req, res, next) => {
	req.allStatistics = [];

	// TODO: Change from fake statistics to actual ones
	if(req.user.statistics == null) {
		req.user.statistics = {
			games: 0,
			wins: 0,
			losses: 0
		};
	}
	const userStatistics = {
		name: req.user.displayName,
		games: req.user.statistics.games,
		wins: req.user.statistics.wins,
		losses: req.user.statistics.losses
	};

	req.allStatistics.push(userStatistics);

	return next();
};