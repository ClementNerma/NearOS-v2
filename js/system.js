
var appQuestionCallback, appConfirmCallback, appDialogCallback, appContextMenuTarget, appSysTarget, windowsZIndex = 5;
var appWinID = 0;

var app = new (function(package, AESKey, args, appID) {

    var _ID = appID;
    var _system;
    var _appQuit = window.appQuit;

    this.callArgs = args || {};
    Object.fullFreeze(this.callArgs);

    var _AESKey = AESKey;
    var _package = package;
    var _name = package.name;
    var _events = {
        createCrashSave: function() {
            return null; // no crash save can be created
        },

        loadCrashSave: function(crashSave) {
            return true;
        },

        respondingTest: function(val) {
            return val * val;
        },

        open: function(path, application, args) {
            return true;
        },

        exit: function() {
            app.exit();
        }
    };

    this.on = function(event, callback) {
        if(callback && typeof callback === 'function')
            _events[event] = callback;

        return _events[event];
    };

    this.exit = function() {
        _appQuit(_ID);
    };

    this.name = function() { return _name; };
    this.package = function() { return _package; };

    this.securityIssue = function(code) {
        return app.fatal('Security issue detected !', 'A security issue has been detected. The running task has been aborted.<br />Please advertise the developpers about this issue using this link :<br /><br /><a href="mailto:clement.nerma@gmail.com?subject=NearOS%20Security%20Issue&body=A security issue has been detected in NearOS (code : ' + code + ').">Send an email</a><br /><br />Or send manually an email to <strong>clement.nerma@gmail.com</strong> and specify the following security issue code : <strong>' + code + '</strong><br /><br />Thank you very much !');
    };

    this.fatal = function(title, content) {
        var node = $('#__fatal');

        node.find('h1').text(title);
        node.find('p').html(content);

        node.data('dialog').open();

        throw new Error('[NearOS] ' + title + '\n' + content);
    };

    this.notify = function(title, message, type) {

        if(!Object.is(title))
            return $.Notify({
                caption: title,
                content: '<br />' + message,
                type: type || 'info'
            });
        else
            return $.Notify(title);

    };

    this.dialog = function(settings) {

        if(appDialogCallback)
            return false;

        var modal = $('#__dialog');
        modal.find('h1').text(settings.title);

        var p = modal.find('p').text(settings.message || '');

        appDialogCallback = {}, buttonID = 0;

        var btns = Object.keys(settings.buttons).reverse(), button;

        for(var j = 0; j < btns.length; j += 1) {
            button    = settings.buttons[btns[j]];
            buttonID += 1;

            appDialogCallback[buttonID] = button.callback;

            p.append(
                $.create('button', {
                    class: 'button' + (button.class ? ' ' + button.class : ''),
                    content: btns[j],
                    bid: buttonID
                }).css('float', 'right').css('margin-right', '5px').on('click', function() {
                    var callback = appDialogCallback[$(this).attr('bid')];
                    appDialogCallback = null;
                    $('#__dialog').data('dialog').close();
                    callback();
                })
            );
        }

        modal.data('dialog').open();

    };

    this.prompt = function(title, question, callback) {
        if(appQuestionCallback)
            return false;

        options = {
            showCancel: true,
            inputType: 'text'
        };

        if(Object.is(title)) {
            options = Object.merge(options, title);
        } else {
            options.title = title;
            options.question = question;
            options.callback = callback;
        }

        var node = $('#__prompt');

        node.find('h1').text(options.title);
        node.find('p').html((options.question ? options.question + '<br /><br />' : '') + '<div class="input-control ' + options.inputType + ' full-size"><input type="' + options.inputType + '" id="__app_prompt" /></div><br />' + (options.showCancel ? '<button class="button danger" role="cancel">Cancel</button>' : '') + '<button class="button primary" style="float:right;" role="validate">OK</button>');

        appQuestionCallback = options.callback;

        node.data('dialog').open();
        node.find('p button[role="cancel"]').on('click', function() {
            var callback = appQuestionCallback;
            appQuestionCallback = false;
            $('#__prompt').data('dialog').close();
            callback(null);
        });
        node.find('p button[role="validate"]').on('click', function() {
            var ans = $(this).parent().find('input:last').val();
            var callback = appQuestionCallback;
            appQuestionCallback = false;
            $('#__prompt').data('dialog').close();
            callback(ans);
        });

    };

    this.confirm = function(title, question, callback) {
        if(appConfirmCallback)
            return false;

        var node = $('#__confirm');

        node.find('h1').text(title);
        node.find('p').html((question ? question + '<br /><br />' : '') + '<button class="button primary" style="float:right;" role="validate">OK</button><button class="button danger" role="cancel" style="float:right;margin-right:5px;">Cancel</button>');

        appConfirmCallback = callback;

        node.data('dialog').open();
        node.find('p button[role="cancel"]').click(function() {
            var callback = appConfirmCallback;
            appConfirmCallback = false;
            $('#__confirm').data('dialog').close();
            callback(false);
        });
        node.find('p button[role="validate"]').click(function() {
            var callback = appConfirmCallback;
            appConfirmCallback = false;
            $('#__confirm').data('dialog').close();
            callback(true);
        });

    };

    this.download = function(filename, content) {
        var a =
            $.create('a',{})
            .hide();

        $('body').append(a);
        var blob = new Blob([content], {type: "octet/stream"}),
            url = window.URL.createObjectURL(blob);

        a
            .attr('href', url)
            .attr('download', filename)

        a[0].click();

        window.URL.revokeObjectURL(url);
        a.remove();
    };

    this.hasAccess = function(permissions, access) {
        if(Array.isArray(permissions[0])) {
            // needs multiple permissions
            for(var i = 0; i < permissions.length; i += 1)
                if(!this.hasAccess(permissions[i], path))
                    return false;

            return true;
        }

        // needs only one permission

        if(!package.permissions[permissions[0]] || !package.permissions[permissions[0]].length)
            return false;

        if(package.permissions[permissions[0]][0].indexOf('*') === -1 && package.permissions[permissions[0]].indexOf(permissions[1]) === -1)
            return false;

        if(access) {
            var hasAccess = false;

            for(var i = 0; i < package.access.length; i += 1)
                if(this.fs.isChild(access, package.access[i])) {
                    hasAccess = true;
                    break;
                }

            if(!hasAccess)
                return false;
        }

        return true;
    };

    this.server = function(request, data, needsPermissions, toDataURL) {
        if(_AESKey) {
            var caller;

            for(var i in app.fs)
                if(app.fs.hasOwnProperty(i))
                    if(app.fs[i] === arguments.callee.caller) {
                        caller = ['fs', i];
                        break;
                    }

            for(var i in app.reg)
                if(app.reg.hasOwnProperty(i))
                    if(app.reg[i] === arguments.callee.caller) {
                        caller = ['reg', i];
                        break;
                    }

            if(!caller) {
                console.error('[app:server] Must be called by a file system or a registry function');
                return false;
            }
        }

        if(needsPermissions && typeof _AESKey === 'undefined') {
            console.error('[app:server] Can\'t do an action which needs privileges without AES-256 encryption key !');
            return false;
        }

        if(needsPermissions && !app.hasAccess(needsPermissions, data.path)) {
            if(arguments.callee.caller.arguments.callee.caller !== app.init) {
                if(!(needsPermissions[0] === 'files' && needsPermissions[1] === 'read' && data.path === '.registry')) {
                    // print caller name and say permissions are insufficient
                    if(!(needsPermissions[0] === 'files' && needsPermissions[1] === 'read' && data.path && app.fs.isChild(data.path, '/apps/' + _name))) {
                        if(arguments.callee.caller.arguments.callee.caller !== app.fs.applicationIcon) {
                            if(arguments.callee.caller.arguments.callee.caller !== app.fs.open) {
                                console.error('[app.' + caller.join('.') + '] Can\'t access to "' + this.fs.normalize(data.path) + '" : Needs more privileges')
                                return false;
                            }
                        }
                    }
                }
            }
        }

        if(!data)
            data = {};

        data.request = request;

        if(_AESKey) {
            for(var i in data)
                if(data.hasOwnProperty(i))
                    data[i] = app.AES.encrypt(data[i].toString(), _AESKey);
        }

        if(toDataURL) {
            var dataURL = '';

            for(var i in data)
                if(data.hasOwnProperty(i))
                    dataURL += '&' + i + '=' + data[i];

            return window.location.href.replace(/\/app\.html$/, '') + (window.location.href.substr(-1) !== '/' ? '/' : '') + 'server/user.php?' + dataURL.substr(1);
        }

        var req = $.ajax({
            url: 'server/user.php',
            method: 'POST',
            async: false,
            dataType: 'text',
            data: data
        });

        try {
            return (req.status === 200 && req.readyState === 4)
                        ? (_AESKey ? app.AES.decrypt(req.responseText, _AESKey) : req.responseText)
                        : false;
        }

        catch(e) {
            return false;
        }
    };

    this.user = function(property) {

        if(this.hasAccess(['user', property]))
            return _system[property];

        console.error('Can\'t get user information : "' + property + '" : Insufficient privileges');
        return false;

    };

    if(window.app_win)

    this.window = new (function() {

        var _window   = window.app_win;
        var _titlebar = _window.find('> .window-caption:first > .window-caption-title:first');
        var _iframe   = _window.find('> iframe:first');

        this.title = function(title) {
            if(typeof title !== 'undefined')
                _titlebar.text(title);

            return _titlebar.text();
        };

        this.showTitlebar = function() { _titlebar.parent().show(); return true; };
        this.hideTitlebar = function() { _titlebar.parent().hide(); return true; };
        this.toggleTitlebar = function() { _titlebar.parent().toggle(); return true; };

        this.width = function(width) {
            if(!width)
                return _window.css('width');

            _window.css('width', width);
            return true;
        };

        this.height = function(height) {
            if(!height)
                return _window.css('height');

            _window.css('height', height);
            return true;
        };

        this.resize = function(width, height) {
            this.width(width);
            this.height(height);
            return ;
        };

        this.show = function() { _window.show(); return true; };
        this.hide = function() { _window.hide(); return true; };
        this.toggle = function() { _window.toggle(); return true; };

        this.close = function() {
            return app.on('exit')();
        };

    })();

    this.process = new (function() {

        var _parent = window.app_win ? window.app_win.parent().parent() : $('#windows');

        function _req(access) {
            if(!app.hasAccess(['process', access])) {
                var target;

                for(var i in app.process)
                    if(app.process[i] === arguments.callee.caller) {
                        target = i;
                        break;
                    }

                console.error('[app.process.' + target + '] Can\'t do action "' + access + '" on frames because privileges are insufficient');
                return false;
            }

            return true;
        }

        this.exists = function(PID) {
            if(!_req('exists'))
                return undefined;

            // using !! to convert a number to boolean (0 : false, != 0 : true)
            return !!_parent.find('iframe[PID="' + PID + '"]').length;
        };

        this.list = function() {
            if(!_req('list'))
                return false;

            var iframes = _parent.find('iframe');
            var infos = [];

            iframes.each(function(subject) {
                subject = $(iframes[subject]);
                var parent = subject.parent();

                infos.push({
                    title: parent.find('> .window-caption:first > .window-caption-title:first').text(),
                    app: subject.attr('app'),
                    PID: parseInt(subject.attr('pid')),
                    started: parseInt(subject.attr('launched-time')),
                    icon: parent.find('> .window-caption:first > .window-caption-icon:first img').attr('src'),
                    uptime: Math.floor(Date.now() / 1000) - subject.attr('launched-time'),
                    width: parent.width(),
                    height: parent.height(),
                    zIndex: parseInt(parent.css('z-index')),
                    visible: parent.is(':visible'),
                    hidden: !parent.is(':visible')
                });
            });

            return infos;

        };

        this.read = function(PID) {

            if(!_req('read'))
                return false;

            var subject = _parent.find('iframe[pid="' + PID + '"]');

            if(!subject.length) {
                console.error('[app.process.read] There is no application running with PID ' + PID);
                return false;
            }

            return subject.contents().find('html:first')[0].outerHTML;

        };

        this.stop = function(PID, now) {

            if(!_req(now ? 'force-stop' : 'stop'))
                return false;

            var subject = _parent.find('iframe[pid="' + PID + '"]');

            if(!subject.length) {
                console.error('[app.process.read] There is no application running with PID ' + PID);
                return false;
            }

            if(now)
                subject[0].contentWindow.app.exit();
            else
                subject[0].contentWindow.app.on('exit')();

            return true;

        };

    });

    this.fs = new (function(server) {

        var _launchApplication = window.launchApplication;

        this.launchApplication = function(name, args) {

            if(name.cutHTML() !== name)
                return app.securityIssue(1);

            if(arguments.callee.caller === app.fs.open) {
                if(app.on('open')(args.open, name, args) === false)
                    return false;
            }

            _launchApplication(name, args);

        };

        this.applicationIcon = function(name) {

            try {
                return JSON.parse(app.fs.readFile('/apps/' + name + '/package.json')).icon;
            }

            catch(e) {
                return 'images/application.png';
            }

        };

        this.applyProtocol = function(cmd, path) {

            if(cmd.substr(0, 4) === 'gui:') {
                if(!app.gui.hasOwnProperty(cmd.substr(4))) {
                    app.notify('Unkown action', cmd.substr(4), 'alert');
                    return '';
                }

                return app.gui[cmd.substr(4)](path);
            } else if(cmd.substr(0, 5) === 'file:') {
                return app.fs.readFile(cmd.substr(5), true, true);
            } else {
                return cmd;
            }

        };

        this.touchFile = function(path) {
            return server('touchfile', {path: path}, ['files', 'write']) === 'true';
        };

        this.writeFile = function(path, content) {
            return server('write_plain_file', {path: path, content: content}, ['files', 'write']) === 'true';
        };

        this.readFile = function(path, asIs, dataURL, download) {
            var req = {
                path: path,
                asIs: asIs ? 'true' : 'false',
                download: download ? 'true' : 'false'
            };

            return server('readfile', req, ['files', 'read'], dataURL);
        };

        this.removeFile = function(path) {
            return server('remove_file', {path: path}, ['files', 'delete']) === 'true';
        };

        this.rename = function(path, newPath) {
            return server('rename', {path: path, newPath: newPath}, ['files', 'move']) === 'true';
        };

        this.readDirectory = function(path, showHidden) {
            var ans = server('read_dir', {path: path}, ['directories', 'read']);

            if(!ans)
                return false;

            ans = JSON.parse(ans);

            if(showHidden)
                return ans;

            // hide hidden files

            var returns = [];

            for(var i = 0; i < ans.length; i += 1)
                if(ans[i].substr(0, 1) !== '.')
                    returns.push(ans[i]);

            return returns;

        };

        this.readDirectoryFiles = function(path) {
            var ans = server('read_dir_files', {path: path}, ['directories', 'read']);
            return ans ? JSON.parse(ans) : false;
        };

        this.readSubDirectories = function(path) {
            var ans = server('read_dir_dirs', {path: path}, ['directories', 'read']);
            return ans ? JSON.parse(ans) : false;
        };

        this.makeDirectory = function(path) {
            return server('mkdir', {path: path}, ['directories', 'make']) === 'true';
        };

        this.exists = function(path) {
            return server('exists', {path: path}, [['directories', 'exists'], ['files', 'exists']]) === 'true';
        };

        this.directoryExists = function(path) {
            return server('dir_exists', {path: path}, ['directories', 'exists']) === 'true';
        };

        this.fileExists = function(path) {
            return server('file_exists', {path: path}, ['files', 'exists']) === 'true';
        };

        this.open = function(path) {

            path = this.normalize(path);

            if(this.directoryExists(path)) {
                // directory
                return app.fs.launchApplication(app.reg.read('fs/directory/open'), {open: path});
            } else if(this.fileExists(path)) {
                // file
                var ext = this.extension(path);

                if(ext === 'lnk') {
                    try {
                        var link = JSON.parse(this.readFile(path));

                        if(link.path)
                            return this.open(link.path);
                        else if(link.app)
                            return app.fs.launchApplication(link.app, link.args || {});
                        else
                            return console.error('Bad shortcut : "' + path + '"');
                    }

                    catch(e) {
                        return false;
                    }
                }

                if(ext)
                    return app.fs.launchApplication(
                        app.reg.read('fs/.' + ext + '/open')
                     || app.reg.read('fs/unknown/open')
                    , {open: path});
                else
                    return app.fs.launchApplication(app.reg.read('fs/unknown/open'), {open: path});
            } else {
                // doesn't exists
                return false;
            }

        };

        this.resource = function(type, path, external) {

            if(!external)
                path = this.normalize('/apps/' + _name + '/' + path);

            var resource = this.readFile(path);

            if(resource === false) {
                console.error('[app:' + name + '] Failed to load resource "' + path + '"');
                return false;
            }

            switch(type.toLocaleLowerCase()) {
                case 'html':
                case 'html5':
                case 'xhtml':
                case 'document':
                    $('#__frame').html(resource);
                    break;

                case 'js':
                case 'javascript':
                case 'ecmascript':
                case 'jscript':
                case 'script':
                    window.eval(resource);
                    break;

                case 'css':
                case 'css3':
                case 'stylesheet':
                    $('head:first').append(
                        $.create('style', {
                            type: 'text/css',
                            content: resource
                        })
                    );
                    break;

                default:
                    console.error('[app:' + _name + '] Unknown resource type : "' + type + '"');
                    return false;
                    break;
            }

            return true;

        };

        this.downloadFile = function(path) {
            /*var content = this.readFile(path);

            if(path === false)
                return false;

            var filename = this.filename(path);

            app.download(filename, content);
            return true;*/

            var dataURL = app.fs.readFile(path, true, true, true);

            if(!dataURL)
                return false;

            $('body').append(
                $.create('iframe', {
                    src: dataURL
                }).hide()
            );

            return true;
        };

        /* Alias */

        this.readDir      = this.readDirectory;
        this.readDirFiles = this.readDirectoryFiles;
        this.readSubDirs  = this.readSubDirectories;
        this.mkdir        = this.makeDirectory;
        this.load         = this.resource;

        this.renameFile      = this.rename;
        this.renameDirectory = this.rename;
        this.renameDir       = this.rename;
        this.move            = this.rename;
        this.moveFile        = this.rename;
        this.moveDirectory   = this.rename;
        this.moveDir         = this.rename;

        /* Misc. functions */

        this.normalize = function(path) {
            var parts = path.split('/'),
                safe  = [];

            for(var i = 0; i < parts.length; i += 1) {
                parts[i] = parts[i].replace(/[^a-zA-Z0-9_\-\+\/ "'\:\,\.\;\{\}\(\)\[\]]/g, '');
                if (!parts[i] || ('.' == parts[i])) {
                    continue;
                } else if('..' == parts[i]) {
                    safe.pop();
                    continue;
                } else {
                    safe.push(parts[i]);
                }
            }

            // Return the "clean" path
            return safe.join('/');
        };

        this.isChild = function(child, parent) {
            parent = this.normalize(parent) + '/';
            child  = this.normalize(child);

            return (
                    (child.substr(0, parent.length) === parent)
                 || (child === parent.substr(0, parent.length - 1))
                 || (parent === '/')
             );
        };

        this.parent = function(path) {
            path = this.normalize(path);

            if(path.indexOf('/') === -1)
                return '';
            else {
                path = path.split('/');
                path.splice(path.length - 1, 1);
                return path.join('/');
            }
        };

        this.filename = function(path) {
            path = this.normalize(path);
            return path.indexOf('/') === -1 ? path : path.substr(path.lastIndexOf('/') + 1);
        };

        this.extension = function(filename) {
            return filename.indexOf('.') !== -1 ? filename.substr(filename.lastIndexOf('.') + 1) : false;
        };

        this.icon = function(path) {
            // returns the image source (ex: "images/folder.png" or "data:image/png......")

            function icon() {
                if(path === false)
                    return false;

                if(path.substr(0, 4) === 'app:') {
                    return app.fs.applicationIcon(path.substr(4));
                }

                if(fs.directoryExists(path)) {
                    // directory
                    return app.reg.read('fs/directory/icon');
                } else if(fs.fileExists(path)) {
                    // file
                    var ext = app.fs.extension(path);

                    if(ext === 'lnk')
                        return app.fs.icon(fs.shortcutTarget(path));

                    return ext ? (app.reg.read('fs/.' + ext + '/icon') || app.reg.read('fs/unknown/icon')) : app.reg.read('fs/unknown/icon');
                } else {
                    // doesn't exists
                    return app.reg.read('fs/unknown/icon');
                }
            }

            return app.fs.applyProtocol(icon(), path);

        };

        this.shortcutTarget = function(path) {
            var file = this.readFile(path);

            if(file === false)
                return false;

            try {
                file = JSON.parse(file);
            }

            catch(e) {
                return false;
            }

            if(typeof file.path === 'undefined')
                return false;

            return file.path;
        };

        this.resolveContextMenu = function(action) {
            $('#__context').hide();
            app.fs.applyProtocol(action, appContextMenuTarget);
        };

        this.htmlShortcut = function(path) {
            var filename = app.fs.filename(path);

            return $.create('div', {
                class: 'list',
                content: [
                    $.create('img', {
                        src: fs.icon(path),
                        class: 'list-icon'
                    }),
                    $.create('span', {
                        class: 'list-title',
                        content: path.substr(0,4)==='app:' ? path.substr(4) : (fs.directoryExists(path) ? filename : filename.replace(/\.lnk$/, '')),
                        path: filename,
                        fullpath: path
                    })
                ]
            }).on('click', function() {
                app.fs.open($(this).find('.list-title').attr('fullpath'));
            }).contextmenu(function(e) {
                if(e.preventDefault)
                    e.preventDefault();

                var filename = $(this).find('.list-title').attr('path');
                var path     = $(this).find('.list-title').attr('fullpath');

                appContextMenuTarget = path;

                $('#__context').html('');

                var menu;

                if(fs.directoryExists(path))
                    menu = app.reg.read('fs/directory/read');
                else if(fs.fileExists(path))
                    menu = (app.reg.read('fs/.' + app.fs.extension(filename) + '/context') || []).concat(app.reg.read('fs/file/context'))
                else
                    return false;

                for(var i = 0; i < menu.length; i += 1) {
                    $('#__context').append(
                        $.create('div', {
                            content: menu[i].title,
                            action: menu[i].path
                        }).on('click', function() {
                            app.fs.resolveContextMenu($(this).attr('action'));
                        })
                    )
                }

                $('#__context').css({
                    top: e.clientY,
                    left: e.clientX,
                    display: 'inline-block'
                });
            });
        };

    })(this.server);

    if(!window.app_win) {
        this.windows = new (function() {

            var _windows = [];

            this.create = function(options) {
                var notMovedWins = $('#windows > .window[not-moved]').length;
                appWinID += 1;
                windowsZIndex += 1;

                var win = $($('#window-template')
                    .html()
                    .replace(/\{\{TITLE\}\}/, options.title || 'Untitled')
                    .replace(/\{\{CONTENT\}\}/, options.content || ''));

                win
                    .css({
                        top: ($('body').height() / 10) + (notMovedWins * 50),
                        left: ($('body').width() / 10) + (notMovedWins * 50),
                        'z-index': windowsZIndex
                    })
                    .attr({
                        'win-id': appWinID,
                        'not-moved': 'true'
                    })
                    .draggable({
                        start: function() {
                            $(this).removeAttr('not-moved');
                        }
                    })
                    .resizable()
                    .on('mousedown', function() {
                        windowsZIndex += 1;
                        $(this).css('z-index', windowsZIndex);
                    })

                    .find('.btn-close:first').click(function() {
                        var content = $(this).parent().parent().find('.window-content');

                        if(content[0].tagName.toLocaleLowerCase() === 'iframe')
                            return content[0].contentWindow.app.on('exit')();
                        else
                            content.parent().remove();
                    });

                $('#windows').append(win);
                return win;
            };

            this.close = function(id) {
                $('#windows div[wid=' + id + ']').remove();
            };

        })();
    }

    this.init = function(AESKey) {
        _AESKey = AESKey;

        _system = app.fs.readFile('.system');

        if(!_system)
            app.fatal('Can\'t get SIF', 'NearOS is unable to get the SIF (.system). Please try again.');

        try {
            _system = JSON.parse(_system);
        }

        catch(e) {
            app.fatal('Bad SIF', 'The SIF (.system) is not a valid JSON file. Please correct it and try again.');
        }

        _system['full-name'] = _system['first-name'] + ' ' + _system['last-name'];
        Object.fullFreeze(_system);

        this.reg = new (function(app) {

            var _reg = app.fs.readFile('.registry');

            if(!_reg)
                app.fatal('Can\'t get registry', 'NearOS is unable to get the registry (.registry). Please try again.');

            try {
                _reg = JSON.parse(_reg);
            }

            catch(e) {
                app.fatal('Bad registry', 'The registry (.registry) is not a valid JSON file. Please correct it and try again.');
            }

            this.write = function (entry, value) {
                if (app.hasAccess(['files', 'write'], '.registry')) {
                    var e = entry.split('/');
                    var t = _reg;

                    for (var i = 0; i < e.length - 1; i++) {
                        if (!t[e[i]]) t[e[i]] = {};
                        t = t[e[i]];
                    }

                    var o = t[e[e.length - 1]];
                    t[e[e.length - 1]] = value;
                    if (!app.fs.writeFile('.registry', JSON.stringify(_reg, null, 4))) {
                        t[e[e.length - 1]] = o;
                        return false;
                    } else return true;
                } else return false;
            };

            this.remove = function (entry) {
                if (app.hasAccess(['files', 'write'], '.registry')) {
                    var e = entry.split('/');
                    var t = _reg;

                    for (var i = 0; i < e.length - 1; i++) {
                        if (!t[e[i]]) return false;
                        t = t[e[i]];
                    }

                    var o = t[e[e.length - 1]];
                    if (!o) return true;
                    delete t[e[e.length - 1]];
                    if (!app.fs.writeFile('.registry', JSON.stringify(reg))) {
                        t[e[e.length - 1]] = o;
                        return false;
                    } else return true;
                } else return false;
            };

            this.read = function (entry) {
               var e = entry.split('/');
               var t = _reg;

               for (var i = 0; i < e.length - 1; i++) {
                   if (!t[e[i]]) return t[e[i]];
                   t = t[e[i]];
               }

               return t[e[e.length - 1]];
            };

            this.has = function (entry) {
                return typeof this.read(entry) !== 'undefined';
            };

        })(this);

        Object.fullFreeze(this);
    };

    this.AES = new (function() {

        var _AES = Aes;
        Object.fullFreeze(_AES);

        this.encrypt = function(plainText, key, bytes) {
            return _AES.Ctr.encrypt(plainText, key, bytes || 256);
        };

        this.decrypt = function(cipherText, key, bytes) {
            return _AES.Ctr.decrypt(cipherText, key, bytes || 256);
        };

    })();

    this.RSA = new (function() {

        var _RSA = pidCrypt;
        Object.fullFreeze(_RSA);

        function certParser(cert){
          var lines = cert.split('\n');
          var read = false;
          var b64 = false;
          var end = false;
          var flag = '';
          var retObj = {};
          retObj.info = '';
          retObj.salt = '';
          retObj.iv;
          retObj.b64 = '';
          retObj.aes = false;
          retObj.mode = '';
          retObj.bits = 0;
          for(var i=0; i< lines.length; i++){
            flag = lines[i].substr(0,9);
            if(i==1 && flag != 'Proc-Type' && flag.indexOf('M') == 0)//unencrypted cert?
              b64 = true;
            switch(flag){
              case '-----BEGI':
                read = true;
                break;
              case 'Proc-Type':
                if(read)
                  retObj.info = lines[i];
                break;
              case 'DEK-Info:':
                if(read){
                  var tmp = lines[i].split(',');
                  var dek = tmp[0].split(': ');
                  var aes = dek[1].split('-');
                  retObj.aes = (aes[0] == 'AES')?true:false;
                  retObj.mode = aes[2];
                  retObj.bits = parseInt(aes[1]);
                  retObj.salt = tmp[1].substr(0,16);
                  retObj.iv = tmp[1];
                }
                break;
              case '':
                if(read)
                  b64 = true;
                break;
              case '-----END ':
                if(read){
                  b64 = false;
                  read = false;
                }
              break;
              default:
                if(read && b64)
                  retObj.b64 += pidCryptUtil.stripLineFeeds(lines[i]);
            }
          }
          return retObj;
        }

        this.encrypt = function(plainText, publicKey) {

            /*-----------------------------------------------------------*
               * ENCRYPT: RSA 1024 bit                                     *
               *-----------------------------------------------------------*/

               // public key
               var params = certParser(publicKey);
               var key = pidCryptUtil.decodeBase64(params.b64);

               // new RSA instance
               var rsa = new pidCrypt.RSA();

              /* RSA encryption
               * get the modulus and exponent from certificate (ASN1 parsing)
               * pem(Array of Bytes)
               */

               // ASN1 parsing
               var asn = pidCrypt.ASN1.decode(pidCryptUtil.toByteArray(key));
               var tree = asn.toHexTree();

               // setting the public key for encryption with retrieved ASN.1 tree
               rsa.setPublicKeyFromASN(tree);

               /*** encrypt */
               var crypted = rsa.encrypt(plainText);
               var fromHex = pidCryptUtil.encodeBase64(pidCryptUtil.convertFromHex(crypted));
               var ciphertext = pidCryptUtil.fragment(fromHex,64)
               return ciphertext;
        };

        this.decrypt = function(cipherText, privateKey) {
            // private key
            params = certParser(privateKey);
            var key = pidCryptUtil.decodeBase64(params.b64);

            // new RSA instance
            var rsa = new pidCrypt.RSA();

            /* RSA decryption
             * get the parameters from certificate (ASN1 parsing)
             * pem(Array of Bytes)
             */

            // ASN1 parsing
            asn = pidCrypt.ASN1.decode(pidCryptUtil.toByteArray(key));
            tree = asn.toHexTree();

            // setting the private key for decryption with retrieved ASN.1 tree
            rsa.setPrivateKeyFromASN(tree);

            /*** decrypt */
            cipherText = pidCryptUtil.decodeBase64(pidCryptUtil.stripLineFeeds(cipherText));
            var plaintext = rsa.decrypt(pidCryptUtil.convertToHex(cipherText));
            return plaintext;
        };

    });

    this.gui = new (function() {

        this.directoryIcon = function(path) {
            var d = app.fs.readDir(path);
            return d.length ? 'images/folder-contains.png' : 'images/folder-empty.png';
        };

        this.imageSelfSource = function(path) {
            return app.reg.read('save-bandwidth') ? 'images/file-unknown.png' : app.fs.readFile(path, true, true);
        };

        this.removeFile = function(path) {
            appSysTarget = path;

            app.confirm('Delete', 'Do you really want to delete this file ?\n\n' + path + '\n\nIt can\'t be recovered !', function(bool) {
                if(bool) {
                    if(!app.fs.removeFile(appSysTarget))
                        app.fatal('Error', 'Failed to delete file :\n\n' + appSysTarget);
                    else
                        app.notify('File deleted', appSysTarget, 'success');
                }
            });
        };

        this.downloadFile = function(path) {
            app.fs.downloadFile(path);
        };

        this.rename = function(path) {
            appSysTarget = path;
            var filename = fs.filename(path);

            app.prompt('Rename', 'Please input the new file name for this file :\n\n' + filename, function(path) {
                if(!path)
                    return ;

                if(!fs.renameFile(appSysTarget, fs.parent(appSysTarget) + '/' + path))
                    app.fatal('Rename error', 'Failed to rename <strong>' + fs.filename(appSysTarget) + '</strong> to <strong>' + path + '</strong>');
            }, filename);
        };

    })();

})(package, window.AESKey, window.callArgs, window.appID);

delete window.AESKey;
delete window.callArgs;
delete window.appID;
delete window.appQuit;
delete window.app_win;

var fs = app.fs; // file system alias

// context menu plugin

var contextMenuHover = false;

$('#__context').on('mouseenter', function() { contextMenuHover = true ; });
$('#__context').on('mouseleave', function() { contextMenuHover = false; });
$('body').on('click', function() {
    if(!contextMenuHover)
        $('#__context').hide();
});
