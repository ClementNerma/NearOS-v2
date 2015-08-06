
function associate(name) {

    app.window.hide();

    if($('#when').is(':checked')) {
        // save app in registry
        app.reg.write('fs/' + extension + '/open', name);

        if(!app.reg.read('fs/' + extension + '/icon'))
            app.reg.write('fs/' + extension + '/icon', fs.applicationIcon(name));

        fs.open(target);
    } else {
        fs.launchApplication(name, {open: target});
    }

    app.exit();

}

//app.window.hideTitlebar();
app.window.width('400px');
app.window.height('300px');

var target = app.callArgs.open;

if(!target)
    app.quit();

var filename = fs.filename(target);
var extension = '.' + fs.extension(filename);

$('body').html('<h3>Choose application to open<br /><strong>' + filename + '</strong></h3><div id="apps" class="listview set-border padding10 list-type-icons" data-role="listview"></div><br /><br /><label class="switch-original"><input type="checkbox" id="when" checked /><span class="check"></span></label> Open all files with extension <strong>' + extension + '</strong> with this application');

var appsList = fs.readSubDirectories('/apps');

if(!appsList)
    app.exit();

var ignore = app.reg.read('associate-application/ignore') || [];

for(var i = 0; i < ignore.length; i += 1)
    if(appsList.indexOf(ignore[i]) !== -1)
        appsList.splice(appsList.indexOf(ignore[i]), 1);

for(i = 0; i < appsList.length; i += 1)
    $('#apps').append(
        fs
            .htmlShortcut('app:' + appsList[i])
            .off('click')
            .on('click', function() {
                associate($(this).text());
            })
    );
