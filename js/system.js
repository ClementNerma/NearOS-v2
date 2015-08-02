
var app = new (function(package, AESKey) {

    var _AESKey = AESKey;

    this.fatal = function(title, content) {
        var node = $('#fatal');

        node.find('h1').text(title);
        node.find('p').html(content);

        node.data('dialog').open();

        throw new Error('[NearOS] ' + title + '\n' + content);
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

    this.server = function(request, data, needsPermissions) {
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

        if(needsPermissions && !_AESKey) {
            console.error('[app:server] Can\'t do an action which needs privileges without user\'s password\'s hash !');
            return false;
        }

        if(needsPermissions && !app.hasAccess(needsPermissions, data.path)) {
            // print caller name and say permissions are insufficient
            console.error('[app.' + caller.join('.') + '] Can\'t access to "' + this.fs.normalize(data.path) + '" : Needs more privileges')
            return false;
        }

        if(!data)
            data = {};

        data.request = request;

        if(_AESKey) {
            for(var i in data)
                if(data.hasOwnProperty(i))
                    data[i] = app.AES.encrypt(data[i].toString(), _AESKey);
        }

        var req = $.ajax({
            url: 'server/user.php',
            method: 'POST',
            async: false,
            dataType: 'text',
            data: data
        });

        /**if(_AESKey)
            console.warn(req.responseText, _AESKey);*/

        return (req.status === 200 && req.readyState === 4)
                                                          ? (_AESKey ? app.AES.decrypt(req.responseText, _AESKey) : req.responseText)
                                                          : false;
    };

    this.fs = new (function(server) {

        this.writeFile = function(path, content) {
            return server('write_plain_file', {path: path, content: content}, ['files', 'write']) === 'true';
        };

        this.readFile = function(path) {
            return server('readfile', {path: path}, ['files', 'read']);
        };

        this.removeFile = function(path) {
            return server('remove_file', {path: path}, ['files', 'delete']) === 'true';
        };

        this.readDirectory = function(path) {
            var ans = server('read_dir', {path: path}, ['directories', 'read']);
            return ans ? JSON.parse(ans) : false;
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

        /* Alias */

        this.readDir      = this.readDirectory;
        this.readDirFiles = this.readDirectoryFiles;
        this.readSubDirs  = this.readSubDirectories;
        this.mkdir        = this.makeDirectory;

        /* Misc. functions */

        this.normalize = function(path) {
            var parts = path.split('/'),
                safe  = [];

            for(var i = 0; i < parts.length; i += 1) {
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

        this.extension = function(filename) {
            return filename.indexOf('.') !== -1 ? filename.substr(filename.lastIndexOf('.') + 1) : false;
        };

    })(this.server);

    this.windows = new (function() {

        var _windows = [];

        this.create = function(options) {
            var window = $($('#window-template')
                .html()
                .replace(/\{\{TITLE\}\}/, options.title || 'Untitled')
                .replace(/\{\{CONTENT\}\}/, options.content || ''));

            $('#windows').append(window);

            return window;
        };

        this.close = function(id) {
            $('#windows div[wid=' + id + ']').remove();
        };

    })();

    this.init = function(AESKey) {
        _AESKey = AESKey;

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
                if (app.hasAccess(['files', 'write'], 'sys/reg')) {
                    var e = entry.split('/');
                    var t = reg;

                    for (var i = 0; i < e.length - 1; i++) {
                        if (!t[e[i]]) return false;
                        t = t[e[i]];
                    }

                    var o = t[e[e.length - 1]];
                    t[e[e.length - 1]] = value;
                    if (!board.fs.writeFile('sys/reg', JSON.stringify(reg, null, 4))) {
                        t[e[e.length - 1]] = o;
                        return false;
                    } else return true;
                } else return false;
            };

            this.remove = function (entry) {
                if (app.hasAccess(['files', 'write'], 'sys/reg')) {
                    var e = entry.split('/');
                    var t = reg;

                    for (var i = 0; i < e.length - 1; i++) {
                        if (!t[e[i]]) return false;
                        t = t[e[i]];
                    }

                    var o = t[e[e.length - 1]];
                    if (!o) return true;
                    delete t[e[e.length - 1]];
                    if (!board.fs.writeFile('sys/reg', JSON.stringify(reg))) {
                        t[e[e.length - 1]] = o;
                        return false;
                    } else return true;
                } else return false;
            };

            this.read = function (entry) {
               var e = entry.split('/');
               var t = reg;

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

})(package, window.AESKey);

delete window.AESKey;

var fs = app.fs; // file system alias
