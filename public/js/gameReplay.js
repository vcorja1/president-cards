/* jshint -W117 */

(function($) {
	$(function() { // DOM Ready

		/* ------------------ Define variables. ------------------- */
		let currMove = 0;


		/* ------------------ Set up game. ------------------- */
		const jsonGame = $('#jsonGame').val();
		if(jsonGame != null) {
			const gameDetails = JSON.parse(jsonGame);
			console.log(gameDetails);
		}
	});
})(jQuery);