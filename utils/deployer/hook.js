var githubhook = require('githubhook');
var busy = false;
var exec = require('child_process').exec;
var github = githubhook({
	port: 9002
});
 
 github.listen();
 
 github.on('push:io-at-spot-raspberry:refs/heads/master', function( data) {
     console.log('hook!', new Date());
     
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