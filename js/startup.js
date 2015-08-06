
var _launchingPackage = {}, _launchingArgs = {}, _launchingNotifies = {}, PID = 0;

function launchApplication(name, args) {
    if(!ready)
        return console.log('[app launcher] Please wait the end of system\'s startup !');

    if(!String.is(name) || !name.match(/^([a-zA-Z0-9_\- ]+)$/))
        return console.error('[app launcher] Bad application name')

    if(!fs.directoryExists('/apps/' + name))
        return console.error('[app launcher] Application "' + name + '" not found', args);

    var application;

    if(!_launchingPackage[name]) {
        application = JSON.parse(fs.readFile('/apps/' + name + '/package.json'));
        application.access.push('/apps/' + name);
        Object.fullFreeze(application);
        _launchingPackage[name] = application;
    } else {
        application = _launchingPackage[name];
    }

    _launchingArgs[name] = args || {};
    Object.fullFreeze(_launchingArgs[name]);

    if(!('sandbox' in document.createElement('iframe')))
        console.warn('[app launcher] The "sandbox" attribute is not supported by your browser.\nThis can cause several security problems.')

    var win = app.windows.create({
        title: name,
        content: 'Loading...'
    }).hide();

    PID += 1;

    _launchingNotifies[PID] = $.Notify({
        keepOpen: true,
        caption: 'Starting application...<span id="notifier_' + PID + '"></span>',
        content: 'Starting <strong>' + application.name + '</strong> (PID <strong>' + PID + ')</strong>',
        icon: '<img src="' + fs.applyProtocol(application.icon || app.reg.read('fs/application/icon')) + '" />'
    });
    _launchingNotifies[PID]._notify.stop().css('opacity', 1);

    win
    .css({
        width: 800,
        height: 450
    })
    .find('.window-caption-icon:first span').replaceWith(
        $.create('img', {
            src: application.icon
        })
    )

    win
    .find('.window-content:first').replaceWith(
        $.create('iframe', {
            src: 'app.html',
            app: name,
            class: 'window-content',
            PID: PID,
            'launched-time': Math.floor(Date.now() / 1000),
            sandbox: 'allow-scripts allow-same-origin'
        }).css({
            height: '100%',
            'box-sizing': 'border-box',
            overflow: 'auto',
            'background-color': 'white'
        }).on('load', function() {
            $(this).attr('launched-time', Math.floor(Date.now() / 1000));

            var name = $(this).attr('app');

            this.contentWindow.parent = '';
            this.contentWindow.top    = '';

            /***** The next command doesn't work and cause a big security problem */
            this.contentWindow.frameElement = '';
            /***** ******/

            this.contentWindow.app_win = $(this).parent();

            //this.contentWindow.parentOpen  = app.fs.open;
            this.contentWindow.launchApplication = window.launchApplication;
            this.contentWindow.appQuit     = function(PID) {
                $('iframe[PID="' + PID + '"]').parent().fadeOut(500, function() {
                    $(this).remove();
                });
            };

            this.contentWindow.appReady(AESKey, _launchingPackage[name], _launchingArgs[name], $(this).attr('PID'));

            _launchingNotifies[$(this).attr('PID')].close();
            $(this).parent().fadeIn(1000);
        })
    );

}

/* ----------------------------------------------------- */

var pubRSA, AESKey, ready;

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

    $('#login, #login-waiting').remove();
    $('#taskbar').show(1000);

    ready = true;

    var notif = app.notify('Loading', 'Loading interface...');

    var path = '/desktop';
    var files = fs.readDirectory(path);

    if(!files)
        app.fatal('Can\'t load directory : "' + path + '"');

    $('#desktop').html('');

    // shortcuts .lnk must display them target name's !

    for(var i = 0; i < files.length; i += 1) {
        $('#desktop').append(
            fs.htmlShortcut(path + '/' + files[i])
        );
    }

    var apps = fs.readSubDirectories('/apps'), appIcon;

    if(!apps)
        app.fatal('Can\'t load applications\' directory');

    var hideApps = app.reg.read('launcher/hide-applications');

    for(var i = 0; i < apps.length; i += 1) {
        appIcon = false;

        try {
            appIcon = JSON.parse(fs.readFile('apps/' + apps[i] + '/package.json')).icon;
        }

        catch(e) {}

        if(hideApps.indexOf(apps[i]) === -1) {
            $('#launcher-apps').append(
                $.create('div', {
                    class: 'list',
                    content: [
                        $.create('img', {
                            src: appIcon || app.reg.read('fs/application/icon'),
                            class: 'list-icon'
                        }),
                        $.create('span', {
                            class: 'list-title',
                            content: apps[i]
                        })
                    ]
                })
            );
        }
    }

    notif.close();
    app.notify({
        caption: 'Welcome back !',
        content: 'Welcome <strong>' + app.user('full-name') + '</strong> !'
    });
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
    /*if(window.location.href.substr(0, 8) === 'https://')
        $('#login-encrypt').attr('checked', false);*/

    $('#login').show();

    $('#login button[type="submit"]').on('click', function() {
        $('#login-waiting').css('display', 'block');

        setTimeout(function() {
            var parent = $('#login');

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

                if(ans !== 'true') {
                    $('#login-waiting').hide();
                    parent.find('[data-role="dialog"]:last p').text(ans).parent().data('dialog').open();
                } else {
                    console.info('Logged in !\nUsername : ' + username + '\nAES Key  : ' + key);
                    var request = key ? app.AES.encrypt('user_session', key) : 'user_session';
                    var response = key ? app.AES.decrypt(app.server(request), key) : app.server(request);

                    try {
                        var session = JSON.parse(response);
                    }

                    catch(e) {
                        $('#login-waiting').hide();
                        console.error('Error during parsing session. Server said after request "' + request + '" :\n\n' + response + '\n\n' + e.stack);
                        app.fatal('Bad session', 'Server returned a bad session - Can\'t get system informations');
                    }

                    AESKey = session.aes;
                    readyLoggedIn(session);
                }
            }
        });
    });

    $('#login button[role="cancel"]').on('click', function() {
        $('#login').remove();
        app.fatal('Login canceled', 'You can now quit the page');
    });

    $('#login input').on('keydown', function(e) {
        if(e.keyCode === 13)
            $('#login button[type="submit"]').trigger('click');
    });
}
