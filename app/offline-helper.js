var storage = require('node-persist'),
    logger = require('./logger');

storage.initSync();

function storeMembers(members) {
    logger.info('storing members');

    storage.setItem('members', members);
}

function storeWorkingDays(workingDays) {
    logger.info('storing working days');

    storage.setItem('workingDays', workingDays);
}

function saveData(uid) {

    var workTimeEntriesToSync = storage.getItem('wte') || [];

    workTimeEntriesToSync.push({
        uid: uid,
        performedAt: new Date()
    });

    logger.info('save offline access for uid: ' + uid);
    storage.setItem('wte', workTimeEntriesToSync);
}

function syncData(socket) {
    var data = storage.getItem('wte');
    if (data && data !== []) {

        var obj = {
            type: 'offlineData',
            data: data
        };

        socket.send(JSON.stringify(obj), {}, function() {
            storage.setItem('wte', []);
        });
    }
}

function authenticateMember(uid) {
    var members = storage.getItem('members');

    if (members) {
        for (var i = 0; i < members.length; i++) {
            if (members[i].uid === uid) {
                saveData(uid);
                return true;
            }
        }
    }

    return false;
}


function authorizeAccess(uid) {
    if (isWorkingTime()) {
        if (authenticateMember(uid)) {

            logger.info('offline access allowed: ' + uid );
            return true;
        } else {

            logger.info('offline access denied: ' + uid+ '. Unknown user.');
            return false;
        }
    } else {

        logger.info('offline access denied: ' + uid + '. No working time.');
        return false;
    }
}

exports.syncData = syncData;
//exports.emptyOfflineData = emptyData;
exports.storeMembers = storeMembers;
exports.storeWorkingDays = storeWorkingDays;
exports.authorizeAccess = authorizeAccess;