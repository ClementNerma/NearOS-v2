
var dir;

function loadDir(path) {
    path = '/' + fs.normalize(path);

    var files = fs.readDirectory(path);

    if(!files)
        app.fatal('Can\'t load directory : "' + path + '"');

    $('#files').html('');

    dir = path;

    if($('#dir').val() !== path)
        $('#dir').val(dir);

    // shortcuts .lnk must display them target name's !

    for(var i = 0; i < files.length; i += 1) {
        $('#files').append(
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
                    })
                ]
            })
        );
    }
}

function loadItem(path) {
    if(fs.directoryExists(path)) {
        return loadDir(path);
    } else if(fs.fileExists(path)) {
        return app.fs.open(path);
    } else {
        return app.fatal('File not found', path);
    }
}

app.fs.load('stylesheet', 'app.css');
app.fs.load('document', 'app.html');

var creating;

$('[role="create-file"] a').click(function(event) {
    if(event) event.preventDefault();

    var legend = $(this).text().toLocaleLowerCase();
    creating = $(this).attr('type');

    app.prompt('Create a new ' + legend, 'Please input the name of the new ' + legend + ' ?', function(name) {
        if(!name)
            return ;

        var success, fullPath;

        if(creating.substr(0, 1) !== '.') {
            // creating a directory
            fullPath = dir + '/' + name;
            success = fs.mkdir(fullPath);
        } else {
            // creating a file
            fullPath = dir + '/' + name + creating;
            success = fs.touchFile(fullPath);
        }

        if(!success)
            app.fatal('Create failed', 'Failed to create ' + legend + ' : "' + fullPath + '"');
        else
            loadDir(dir);
    });
});

$('#search').click(function() {
    loadItem($('#dir').val());
});

$('#dir').keydown(function(event) {
    if(event.keyCode === 13) {
        $('#search').trigger('click');
    }
});

$('#go-parent-dir').click(function() {
    loadDir(fs.parent(dir));
});

$('[role="list-type"] a').click(function() {
    console.log('hello');
    var add = $(this).attr('list-class');
    $('#files').removeClass('list-type-icons list-type-tiles list-type-listing');

    if(add)
        $('#files').addClass('list-type-' + add);
});

loadDir(app.callArgs.open || '/');
