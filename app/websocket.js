//Services & Helpers
var actuatorService = require('./actuator');
var offlineHelper = require('./offline-helper');
var config = require('./config/config');
var log = require('./logger');
//NPM dependencies
var WebSocket = require('ws');
var storage = require('node-persist');

//Start of parallel entities
require('./config/close_handler');
// require('./ble')(this);
require('./nfc')(this);
require('./web/web')(this);

//Module vars
var _socket = null;
var _isConnected = false;
var _readingUid = false;
var _readingUidTimeout = null;
var _callback = null;
var _dataObj = null;

function isOnline() {
    return _isConnected;
}

function closedSockedHandler() {
    if(_socket != null){
        setTimeout(function() {
            
            _socket.close();
            _socket = null;
            
            connectSocket();
        }, 5000);
    }
}

/*
 * This function manages the socket connection:
 * 1: try the connection
 * 2: register socket events handler
 */
function connectSocket() {

    _socket = new WebSocket(config.SERVER_ADDR + ':' + config.SERVER_SOCKET_PORT + '/ws', {
        perMessageDeflate: false
    });

    _socket.on('open',function open() {
        log.debug('socket connected');
        _isConnected = true;

        //Cache mgmt
        offlineHelper.syncData(_socket);
    });

    _socket.on('close',function () {
        // socket disconnected
        _isConnected = false;

        log.warn('socket disconnected');

        closedSockedHandler();
    });

    // _socket.on('connect_timeout', function () {

    //     log.warn('socket timed out');

    //     authenticate();
    // });

    _socket.on('error', function (err) {
        log.error(err, 'socket error');
        _socket.close();
        
        closedSockedHandler();
    });

    _socket.on('message', function (msg) {

        _dataObj = JSON.parse(msg);
        
        
        log.debug('MESSAGE RECEIVED: ', _dataObj);

        if (_dataObj.type === 'read') {
            log.info('reading nfc uid request, start blinking');

            _readingUid = true;
            actuatorService.startBlinking();

            _readingUidTimeout = setTimeout(function () {
                log.info('was not possible to read uid in last 5 seconds');

                var obj = {
                    type: 'uid',
                    data: null
                };

                _socket.send(JSON.stringify(obj), {});

                actuatorService.stopBlinking();
                _readingUid = false;
            }, 10000);
        } else if (_dataObj.type === 'members') {
            offlineHelper.storeMembers(_dataObj.data);
        } else if (_dataObj.type === 'workingDays') {
            offlineHelper.storeWorkingDays(_dataObj.data);
        } else if (_dataObj.type === 'response') {
            var response = _dataObj.data;
            
            if (response.responseCode == 200) {
                
                //Need more specified details on authentication
                if (response.open) {
                    actuatorService.openDoor();
                } else {
                    actuatorService.notifyOk();
                }
            } else {
                //Need more specified details on authentication error
                actuatorService.error();
            }
            
            if(_callback){
                _callback(response);
                _callback = null;
            }
        }
    });
}

function onNFCTagSubmitted(uid) {
    log.info('nfc tag read, uid:' + uid);

    if (_readingUid) {
        var obj = {
            type: 'uid',
            data: {
                id: _dataObj.data,
                uid: uid
            }
        };

        _socket.send(JSON.stringify(obj));

        //Clear timeout and status variable
        actuatorService.stopBlinking();
        _readingUid = false;
        clearTimeout(_readingUidTimeout);
    } else {
        if (isOnline()) {

            var obj = {
                type: 'nfcTagSubmitted',
                data: {
                    uid: uid
                }
            };

            _socket.send(JSON.stringify(obj));
        } else {
            if (isWorkingTime() && offlineHelper.authorizeAccess(uid)) {
                actuatorService.openDoor();
            } else {
                actuatorService.error();
            }
        }
    }
}

function onTokenSubmitted(stringData, accessType, callback) {
    log.info('token read:' + stringData);

    if (isOnline()) {
        if (isWorkingTime()) {
        
            var token = stringData;
    
    
            var obj = {
                type: 'tokenSubmitted',
                data: {
                    token: token,
                    mark: (accessType !== 1),
                    open: (accessType !== 2)
                }
            };
        

            _socket.send(JSON.stringify(obj));
            
            _callback = callback;
        } else {
    
            actuatorService.error();
    
            callback({
                responseCode: 403,
                message: 'Access not allowed at this time'
            });
        }

    } else {
        log.warn('device is offline, cannot authenticate.');

        actuatorService.error();

        callback({
            responseCode: 503,
            message: 'device is offline, cannot authenticate'
        });
    }
}


function isWorkingTime() {
    var now = new Date();
    var workingDays = storage.getItem('workingDays');
    
    if(!workingDays || workingDays.length === 0) return true;

    var dayIndex = now.getDay();

    var startTime = new Date(workingDays[dayIndex].startOfficeTime);
    
    var startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), workingDays[dayIndex].startHour, workingDays[dayIndex].startMinute, 0, 0);
    var endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), workingDays[dayIndex].endHour, workingDays[dayIndex].endMinute, 0, 0);

    return (workingDays[dayIndex].active &&
        startTime <= now &&
        endTime >= now);
}



log.debug('starting socket service');

connectSocket();

exports.onNFCTagSubmitted = onNFCTagSubmitted;
exports.onTokenSubmitted = onTokenSubmitted;