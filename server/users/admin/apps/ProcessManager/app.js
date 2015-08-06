
var killingProcess, endingProcess;

app.window.title('Process Manager');
app.window.resize(480, 'auto');

app.fs.load('script', 'jquery.dataTables.min.js');
app.fs.load('document', 'app.html');
app.fs.load('stylesheet', 'app.css');

var list = app.process.list();

for(var i = 0; i < list.length; i += 1)
    if(list[i].app !== app.name())
        $('#list').append(
            $.create('tr', {
                PID: list[i].PID,
                content: [
                    $.create('td', {
                        content: list[i].app
                    }),
                    $.create('td', {
                        content: list[i].title
                    }),
                    $.create('td', {
                        content: list[i].PID
                    }),
                    $.create('td', {
                        content: list[i].uptime
                    })
                ]
            })
            .on('contextmenu', function(e) {
                if(e.preventDefault)
                    e.preventDefault();

                $('#__context')
                    .attr('PID', $(this).attr('PID'))
                    .html('')
                    .append([
                        $.create('div', {
                            content: 'End process'
                        }).on('click', function() {
                            endingProcess = $(this).parent().attr('PID');

                            app.confirm('End process', 'Do you really want to stop this process (PID ' + endingProcess + ') ?', function(bool) {
                                if(!bool)
                                    return ;

                                if(!app.process.exists(endingProcess))
                                    return app.fatal('Error', 'This process does no longer exists');
                                else
                                    app.process.stop(endingProcess);
                            });
                        }),
                        $.create('div', {
                            content: 'Kill process'
                        }).on('click', function() {
                            killingProcess = $(this).parent().attr('PID');

                            app.confirm('Stop process', 'Do you really want to kill this process (PID ' + killingProcess + ') ?\nAll unsaved data will be lost !', function(bool) {
                                if(!bool)
                                    return ;

                                if(!app.process.exists(killingProcess))
                                    return app.fatal('Error', 'This process does no longer exists');
                                else
                                    app.process.stop(killingProcess, true);
                            });
                        })
                    ])
                    .css({
                        top: e.clientY,
                        left: e.clientX,
                        display: 'inline-block'
                    });
            })
        );

$('#processes').dataTable({
    language: {
        emptyTable: 'No process is running'
    }
});


// add buttons to stop processes !
