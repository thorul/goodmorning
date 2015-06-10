var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
    name:'MARS-GoodMorning',
    description: 'A NodeJS instance to host MARS tools.',
    script: 'C:\\apps\\projects\\goodmorning\\bin\\www'
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
    console.log("Service installed. Starting...");
    svc.start();
    console.log("Service started.");
});

/*
// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall',function(){
    console.log('Uninstall complete.');
    console.log('The service exists: ',svc.exists);
});
*/

svc.install();
// svc.uninstall();
