
function createFile(force) {

    if(hasChanges && !force) {
        opening = file;
        return app.dialog({
            title: 'New file',
            message: 'The file "' + fs.filename(file) + '" has been modified. Do you want to save it ?\nAll unsaved modifications will be lost.',
            buttons: {
                'Don\'t save': {
                    class: 'info',
                    callback: function() {
                        createFile(true);
                    }
                },
                Save: {
                    class: 'info',
                    callback: function() {
                        saveFile(function() {
                            openFile(true);
                        });
                    }
                },
                Cancel: {
                    class: 'info',
                    callback: function() {}
                }
            }
        });
    }

    file = null;
    $('#editor').val('');
    hasChanges = false;

}

function openFile(path, force) {

    if(hasChanges && !force) {
        opening = path;
        return app.dialog({
            title: 'Save changes',
            message: 'The file "' + fs.filename(file) + '" has been modified. Do you want to save it ?\nAll unsaved modifications will be lost.',
            buttons: {
                'Don\'t save': {
                    class: 'info',
                    callback: function() {
                        openFile(opening, true);
                    }
                },
                Save: {
                    class: 'info',
                    callback: function() {
                        saveFile(function() {
                            openFile(opening, true);
                        });
                    }
                },
                Cancel: {
                    class: 'info',
                    callback: function() {}
                }
            }
        });
    }

    var content = fs.readFile(path);

    if(content === false)
        app.fatal('Error', 'Failed to load "' + path + '"');

    file = path;
    $('#editor').val(content);
    hasChanges = false;

}

function saveFile(onSuccess, onFail) {

    saveFileSuccess = onSuccess || function(){};
    saveFileFail    = onFail    || function(){};

    if(!file)
        return app.prompt('Save as...', 'Please input the new file path', function(path) {
            if(!path)
                return saveFileFail ? saveFileFail() : false;

            file = path;
            saveFile(saveFileSuccess, saveFileFail);
        });

    if(!fs.writeFile(file, $('#editor').val())) {
        saveFileFail();
        app.fatal('Error', 'Can\'t save file "' + path + '"');
    } else {
        hasChanges = false;
        saveFileSuccess();
    }

}

var file = '', hasChanges, opening, saveFileSuccess, saveFileFail;

app.fs.load('stylesheet', 'app.css');
app.fs.load('document', 'app.html');

if(app.callArgs.open)
    openFile(app.callArgs.open);

$('#create').click(function() {
    createFile();
});

$('#open').click(function() {
    app.prompt('Open', 'Please input the file path', function(path) {
        if(path)
            openFile(path);
    });
});

$('#save').click(function() {
    saveFile();
});

$('#download').click(function() {
    saveFile(function() {
        fs.downloadFile(file);
    });
});

$('#editor').on('keydown', function() {
    hasChanges = true;
});

app.on('exit', function() {
    if(hasChanges) {
        return app.dialog({
            title: 'Save changes',
            message: 'The file "' + fs.filename(file) + '" has been modified. Do you want to save it ?\nAll unsaved modifications will be lost.',
            buttons: {
                'Don\'t save': {
                    class: 'info',
                    callback: function() {
                        app.exit();
                    }
                },
                Save: {
                    class: 'info',
                    callback: function() {
                        saveFile(function() {
                            app.exit();
                        });
                    }
                },
                Cancel: {
                    class: 'info',
                    callback: function() {}
                }
            }
        });
    } else
        app.exit();
});
