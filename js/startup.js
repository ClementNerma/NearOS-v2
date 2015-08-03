
var _launchingPackage = {}, _launchingArgs = {}, appID = 0;

function launchApplication(name, args) {
    if(!ready)
        return console.log('[app launcher] Please wait the end of system\'s startup !');

    if(!String.is(name) || !name.match(/^([a-zA-Z0-9_\- ]+)$/))
        return console.error('[app launcher] Bad application name')

    if(!fs.directoryExists('/apps/' + name))
        return console.error('[app launcher] Application "' + name + '" not found', args);

    if(!_launchingPackage[name]) {
        var package = JSON.parse(fs.readFile('/apps/' + name + '/package.json'));
        package.access.push('/apps/' + name);
        Object.fullFreeze(package);
        _launchingPackage[name] = package;
    }

    _launchingArgs[name] = args || {};
    Object.fullFreeze(_launchingArgs[name]);

    if(!('sandbox' in document.createElement('iframe')))
        console.warn('[app launcher] The "sandbox" attribute is not supported by your browser.\nThis can cause several security problems.')

    var win = app.windows.create({
        title: name,
        content: 'Loading...'
    });

    appID += 1;

    win.find('.window-content:first').replaceWith(
        $.create('iframe', {
            src: 'app.html',
            app: name,
            class: 'window-content',
            appID: appID,
            sandbox: 'allow-scripts allow-same-origin'
        }).css({
            width: 800,
            height: 400
        }).on('load', function() {
            var name = $(this).attr('app');

            this.contentWindow.parent = '';
            this.contentWindow.top    = '';
            this.contentWindow.frameElement = '';

            this.contentWindow.parentOpen  = app.fs.open;
            this.contentWindow.appQuit     = function(appID) {
                $('iframe[appID="' + appID + '"]').parent().remove();
            };
            this.contentWindow.appReady(AESKey, _launchingPackage[name], _launchingArgs[name], $(this).attr('appID'));
        })
    );
}

/* ----------------------------------------------------- */

var pubRSA, AESKey, ready;

$('#launcher-menu, #login').hide();

$('#launcher-icon').click(function() {
    var menu = $('#launcher-menu'),
        height = document.body.scrollHeight;

    if(menu.is(':visible')) {
        // close
        menu
            .css('top', height / 3 - 40)
            .animate({
                top: height
            }, 500, 'linear', function() {
                $('#launcher-menu').hide();
            })
    } else {
        // open
        menu
            .css('top', height)
            .show()
            .animate({
                top: height / 3 - 40
            }, 500, 'linear');
    }
});

function readyLoggedIn(session) {
    app.init(session.aes);

    $('#login').remove();
    $('#taskbar').show(1000);

    ready = true;

    var path = '/desktop';
    var files = fs.readDirectory(path);

    if(!files)
        app.fatal('Can\'t load directory : "' + path + '"');

    $('#desktop').html('');

    // shortcuts .lnk must display them target name's !

    for(var i = 0; i < files.length; i += 1) {
        $('#desktop').append(
            $.create('div', {
                class: 'list',
                content: [
                    $.create('img', {
                        src: fs.icon(path + '/' + files[i]),
                        class: 'list-icon'
                    }),
                    $.create('span', {
                        class: 'list-title',
                        content: files[i]
                    }).css('font-size', '15px')
                ]
            })
        );
    }

    var apps = fs.readSubDirectories('/apps');

    if(!apps)
        app.fatal('Can\'t load applications\' directory');

    for(var i = 0; i < apps.length; i += 1) {
        $('#launcher-apps').append(
            $.create('div', {
                class: 'list',
                content: [
                    $.create('img', {
                        src: app.reg.read('fs/application/icon'),
                        class: 'list-icon'
                    }),
                    $.create('span', {
                        class: 'list-title',
                        content: apps[i]
                    })
                ]
            })
        )
    }
}

$('#taskbar').hide();

$.ajax({
    method: 'GET',
    url: 'server/rsa-public-4096.key',
    timeout: 5000,
    success: function(key) {
        console.info('Got RSA public key');
        pubRSA = key;
        loginShow();
    },
    error: function() {
        console.error('Failed to get RSA public key !', this);
        app.fatal('Failed to get RSA public key', 'Failed to get RSA public key. Please check that the file "server/rsa-public-4096.key" is accessible.');
    }
});

function loginShow() {
    if(window.location.href.substr(0, 8) === 'https://')
        $('#login-encrypt').attr('checked', false);

    $('#login').show().find('button[type="submit"]').on('click', function() {
        var parent = $(this).parent().parent().parent();

        var username = parent.find('input[data="username"]').val();
        var password = parent.find('input[data="password"]').val();

        if(!username || !password)
            parent.find('[data-role="dialog"]:first').data('dialog').open();
        else {
            var key, cryptedAESKey;

            if($('#login-encrypt').is(':checked')) {
                key = '';

                for(var i = 0; i < 32; i += 1)
                    key += 'abcdefghijklmnopqrstuvwxyz0123456789'.substr(Math.randomInt(32) - 1, 1);

                cryptedAESKey = app.RSA.encrypt(key, pubRSA);
            }

            var ans = app.server('login', {
                username: username,
                password: password,
                aeskey  : key ? cryptedAESKey : undefined
            });

            if(ans !== 'true')
                parent.find('[data-role="dialog"]:last p').text(ans).parent().data('dialog').open();
            else {
                console.info('Logged in !\nUsername : ' + username + '\nAES Key  : ' + key);
                var request = key ? app.AES.encrypt('user_session', key) : 'user_session';
                var response = key ? app.AES.decrypt(app.server(request), key) : app.server(request);

                try {
                    var session = JSON.parse(response);
                }

                catch(e) {
                    console.error('Error during parsing session. Server said after request "' + request + '" :\n\n' + response + '\n\n' + e.stack);
                    app.fatal('Bad session', 'Server returned a bad session - Can\'t get system informations');
                }

                AESKey = session.aes;
                readyLoggedIn(session);
            }
        }
    });

    $('#login button[role="cancel"]').click(function() {
        $('#login').remove();
        app.fatal('Login canceled', 'You can now quit the page');
    });
}
