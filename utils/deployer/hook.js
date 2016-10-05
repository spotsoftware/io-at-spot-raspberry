var gith = require('gith').create(9002); // run on port 9002
var exec = require('child_process').exec;
var busy = false;

gith({
    repo: 'spotsoftware/io-at-spot-raspberry', // the github-user/repo-name
    branch: 'master'
}).on('all', function (payload) {
    if (!busy) {
        busy = true;
        exec('./hook.sh', function (err, stdout, stderr) {
            if (err) {
                console.log('error', err);
                return err;
            }
            console.log(stdout);
            console.log("deploy terminated");
            busy = false;
        });
    }
});