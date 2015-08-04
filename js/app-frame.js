
function appReady(AESKey, package, args, appID) {
    window.package  = package;
    window.callArgs = args;
    window.appID    = appID;
    window.aeskey   = AESKey;

    Object.fullFreeze(package);
    Object.fullFreeze(callArgs);

    $.ajax({
        method: 'GET',
        url: 'js/system.js',
        dataType: 'text',
        async: false,
        success: function(code) {
            $('body').append(
                $.create('script', {
                    type: 'text/javascript',
                    content: code + '\nsystemReady();'
                })
            );
        },
        error: function() {
            return parentFatal('Can\'t load NearOS system.js file. Application can\'t continue.');
        }
    })
}

function systemReady() {
    var AESKey = window.aeskey;
    delete window.aeskey;
    app.init(AESKey);

    var source = fs.readFile('apps/' + app.name() + '/app.js');

    if(source === false) {
        return app.fatal('Can\'t load application main file [app.js]. Application can\'t continue');
    }

    window.eval(source);
}
