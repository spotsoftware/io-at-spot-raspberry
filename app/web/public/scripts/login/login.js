(function() {
'use strict';

	angular
		.module('io.doorkeeper')
		.controller('LoginController', LoginController);
	
	LoginController.$inject = ['auth', '$mdToast', '$state', '$scope']
	function LoginController(auth, $mdToast, $state, $scope) {
		
	}
})();