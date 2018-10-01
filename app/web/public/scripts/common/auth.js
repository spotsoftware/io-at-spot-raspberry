(function () {
    'use strict';

    angular
        .module('io.doorkeeper')
        .factory('auth', AuthService);

    AuthService.$inject = ['$http', '$q', 'localStorageService', '$timeout', '$rootScope', 'CONFIG', 'session', '$cookies'];

    function AuthService($http, $q, localStorageService, $timeout, $rootScope, CONFIG, session, $cookies) {
        var authService = {},
            $authDeferred = null;

        function init() {

            var authData = localStorageService.get('authorizationData');
            var google_token = $cookies['google_token'];
            
            if (authData) {
                authService.getLocalUser(authData.token); 
            } else if (google_token){
                authService.getLocalUser(google_token);                
            };
        }

        authService.resolveAuthentication = function () {

            if (!$authDeferred) {
                init();
            }
            return $authDeferred.promise;
        };


        authService.login = function (data) {

            var deferred = $q.defer();

            $http.post(CONFIG.ioUrl + 'auth/local', data)
                .then(function (res) {

                    localStorageService.set('authorizationData', {
                        token: res.data.token
                    });
                    
                    return authService.refresh();

                }).then(function(res){
                    deferred.resolve(res);
                }).catch(function(reason){
                    deferred.reject(reason);
                });

            return deferred.promise;
        };

        authService.getLocalUser = function (google_token) {

            $authDeferred = $q.defer();

            var req = {
                method: 'GET',
                url: CONFIG.ioUrl + 'api/user/me',
                headers: {
                  'Authorization': 'Bearer ' + google_token
                }
               };

            $http(req).then(function (res) {

                localStorageService.set('authorizationData', {
                    token: google_token
                });

                session.create(res.data.id, res.data.userName, res.data.email, google_token);

                $authDeferred.resolve(res);

            }).catch(function (reason) {
                $authDeferred.reject(reason);
                authService.logout();
            });

            return $authDeferred.promise;
        };

        authService.logout = function () {
            localStorageService.remove('authorizationData');
            session.destroy();
            $authDeferred = null;
        };

        authService.isAuthPending = function () {
            return !!$authDeferred;
        };

        authService.isAuthenticated = function () {
            return !!session.id;
        };

        init();
        
        return authService;
    }
})();