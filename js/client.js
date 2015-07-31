
$.create = function(tag, attr) {
    if(!attr) attr = {};
    var e = $(document.createElement(tag));

    if(attr.content) {
        e.html(attr.content);
        delete attr.content;
    }

    if(attr.class) {
        e.addClass(attr.class);
        delete attr.class;
    }

    return e.attr(attr);
};

$('#launcher-menu').hide();

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

var os = new (function() {

    this.server = function(request, data) {
        if(!data)
            data = {};

        data.request = request;

        var req = $.ajax({
            url: 'server/user.php',
            async: false,
            dataType: 'text',
            data: data
        });

        return (req.status === 200 && req.readyState === 4) ? req.responseText : false;
    };

    this.fs = new (function() {

        this.writeFile = function(file, content) {
            return os.server('write_plain_file', {file: file, content: content}) === 'true';
        };

        this.readFile = function(file) {
            return os.server('readfile', {file: file});
        };

        this.mkdir = function(dir) {
            return os.server('mkdir', {dir: dir}) === 'true';
        };

        this.exists = function(path) {
            return os.server('exists', {path: path}) === 'true';
        }

        this.dirExists = function(dir) {
            return os.server('dir_exists', {dir: dir}) === 'true';
        };

        this.fileExists = function(file) {
            return os.server('file_exists', {file: file}) === 'true';
        };

    })();

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

})();

function readyWork() {
    $('#login').remove();
    $('#taskbar').show();
}

if(os.server('logged') !== 'true') {
    $('#taskbar').hide();

    $('#login').find('button').on('click', function() {
        var parent = $(this).parent().parent().parent();

        var username = parent.find('input[data="username"]').val();
        var password = parent.find('input[data="password"]').val();

        if(!username || !password)
            parent.find('[data-role="dialog"]:first').data('dialog').open();
        else {
            var ans = os.server('login', {
                username: username,
                password: password
            });

            if(ans !== 'true')
                parent.find('[data-role="dialog"]:last p').text(ans).parent().data('dialog').open();
            else
                readyWork();
        }
    });
} else {
    readyWork();
}
