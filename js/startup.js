
var pubRSA;

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

    var files = fs.readDir('desktop'),
        ext, filename, icon;

    for(var i = 0; i < files.length; i += 1) {
        if(fs.fileExists('desktop/' + files[i])) {
            // file
            ext = fs.extension(files[i]);

            if(ext === 'lnk') {
                // shortcut
                icon = fs.icon(files[i], true);
                filename = fs.shortcutTarget(files[i]);
            } else {
                // "normal" file
                icon = fs.icon(files[i]);
                filename = files[i];
            }
        } else {
            // directory
            filename = files[i];
        }

        $('#desktop').append(
            $.create('div', {
                class: 'shortcut',
                content: [
                    $.create('img', {
                        src: icon
                    }),
                    $.create('span').text(files[i])
                ]
            })
        );
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
    $('#login').show().find('button[type="submit"]').on('click', function() {
        var parent = $(this).parent().parent().parent();

        var username = parent.find('input[data="username"]').val();
        var password = parent.find('input[data="password"]').val();

        if(!username || !password)
            parent.find('[data-role="dialog"]:first').data('dialog').open();
        else {
            var key = '';

            for(var i = 0; i < 32; i += 1)
                key += 'abcdefghijklmnopqrstuvwxyz0123456789'.substr(Math.randomInt(32) - 1, 1);

            var cryptedAESKey = app.RSA.encrypt(key, pubRSA);

            var ans = app.server('login', {
                username: username,
                password: password,
                aeskey  : cryptedAESKey
            });

            if(ans !== 'true')
                parent.find('[data-role="dialog"]:last p').text(ans).parent().data('dialog').open();
            else {
                console.info('Logged in !\nUsername : ' + username + '\nAES Key  : ' + key);
                var request = app.AES.encrypt('user_session', key);

                try {
                    var session = JSON.parse(app.AES.decrypt(app.server(request), key));
                }

                catch(e) {
                    app.fatal('Bad session', 'Server returned a bad session - Can\'t get system informations');
                }

                readyLoggedIn(session);
            }
        }
    });

    $('#login button[role="cancel"]').click(function() {
        $('#login').remove();
        app.fatal('Login canceled', 'You can now quit the page');
    });
}
