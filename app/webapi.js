//Services & Helpers
var actuatorService = require('./actuator');
var offlineHelper = require('./offline-helper');
var config = require('./config/config');
var log = require('./logger');
//NPM dependencies
var storage = require('node-persist');
var got = require("got");

//Start of parallel entities
require('./config/close_handler');
// require('./ble')(this);
require('./nfc')(this);
require('./web/web')(this);

//Module vars

var _serverUrl = config.SERVER_ADDR + ':' + config.SERVER_PORT;
var _requestOptions = {
    timeout: 5000,
    retries: 0,
    headers: {
        'Content-type': 'application/json',
        'X-API-KEY': config.API_KEY
    },
};


function getData() {

    got(_serverUrl + '/api/device/data', _requestOptions)
        .then(function(response) {
            var body = JSON.parse(response.body);
            offlineHelper.storeMembers(body.users);
            offlineHelper.storeWorkingDays(body.workingDays);
        })
        .catch(function(error) {
            console.log('error', error);
        });

}

function syncData() {
    var data = offlineHelper.getDataToSync();
    if (data.length <= 0) {
        return;
    }

    var opt = JSON.parse(JSON.stringify(_requestOptions));
    opt.body = JSON.stringify(data);

    got(_serverUrl + '/api/device/offlinewtl', opt)
        .then(function(response) {
            offlineHelper.clearSyncData();
        })
        .catch(function(error) {
            console.log('error', error);
        });
}

function setupRefreshInterval() {

    getData();

    setInterval(function() {

        getData();

    }, 1000 * 60 * 1);
}

function setupSyncInterval() {

    syncData();

    setInterval(function() {

        syncData();

    }, 1000 * 60 * 1.5);
}

function onNFCTagSubmitted(uid, callback) {
    log.info('nfc tag read, uid:' + uid);

    var obj = {
        uid: uid
    };

    var opt = JSON.parse(JSON.stringify(_requestOptions));
    opt.body = JSON.stringify(obj);


    got(_serverUrl + '/api/device/nfctag', opt)
        .then(function(response) {
            actuatorService.openDoor();
            callback();
        })
        .catch(function(error) {
            if (error.statusCode != 401 || error.code == 'ETIMEDOUT') {
                if (isWorkingTime() && offlineHelper.authorizeAccess(uid)) {
                    actuatorService.openDoor();
                }
                else {
                    actuatorService.error();
                }
                callback();
            }
            else {
                console.log(error);
                //Need more specified details on authentication error
                actuatorService.error();
                callback();
            }
        });

}

function onTokenSubmitted(stringData, accessType, callback) {
    log.info('token read:' + stringData);

    if (isWorkingTime()) {

        var token = stringData;

        var obj = {
            token: token,
            mark: (accessType !== 1),
            open: (accessType !== 2)
        };

        var opt = JSON.parse(JSON.stringify(_requestOptions));
        opt.body = JSON.stringify(obj);

        got(_serverUrl + '/api/device/token', opt)
            .then(function(response) {
                //Need more specified details on authentication
                if (obj.open) {
                    actuatorService.openDoor();
                }
                else {
                    actuatorService.notifyOk();
                }

                callback({
                    responseCode: 200,
                    message: 'successfully authenticated'
                });
            })
            .catch(function(error) {
                console.log(error);
                if (error.statusCode != 401 || error.code == 'ETIMEDOUT') {
                    log.warn('device is offline, cannot authenticate.');
                    actuatorService.error();

                    callback({
                        responseCode: 503,
                        message: 'device is offline, cannot authenticate'
                    });
                }
                else {
                    //Need more specified details on authentication error
                    actuatorService.error();

                    callback({
                        responseCode: 500,
                        message: 'error'
                    });
                }
            });



    }
    else {

        actuatorService.error();

        callback({
            responseCode: 403,
            message: 'Access not allowed at this time'
        });
    }

}


function isWorkingTime() {
    var now = new Date();
    var workingDays = storage.getItem('workingDays');

    if (!workingDays || workingDays.length === 0) return true;

    var dayIndex = now.getDay();

    var startTime = new Date(workingDays[dayIndex].startOfficeTime);

    var startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), workingDays[dayIndex].startHour, workingDays[dayIndex].startMinute, 0, 0);
    var endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), workingDays[dayIndex].endHour, workingDays[dayIndex].endMinute, 0, 0);

    return (workingDays[dayIndex].active &&
        startTime <= now &&
        endTime >= now);
}

log.debug('starting webapi service');

setupRefreshInterval();
setupSyncInterval();

exports.onNFCTagSubmitted = onNFCTagSubmitted;
exports.onTokenSubmitted = onTokenSubmitted;