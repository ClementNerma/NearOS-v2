<?php

session_start();

require 'config.php';

const DS = DIRECTORY_SEPARATOR;

function normalizePath($path, $encoding="UTF-8") {
    // Attempt to avoid path encoding problems.
    $path = iconv($encoding, "$encoding//IGNORE//TRANSLIT", $path);
    // Process the components
    $parts = explode('/', $path);
    $safe = array();
    foreach ($parts as $idx => $part) {
        if (empty($part) || ('.' == $part)) {
            continue;
        } elseif ('..' == $part) {
            array_pop($safe);
            continue;
        } else {
            $safe[] = $part;
        }
    }

    // Return the "clean" path
    $path = implode(DIRECTORY_SEPARATOR, $safe);
    return $path;
}

function get_func_argNames($funcName) {
    $f = new ReflectionFunction($funcName);
    $result = array();
    foreach ($f->getParameters() as $param) {
        $result[] = $param->name;
    }
    return $result;
}

if(!isset($_SESSION['nearos']))
    $_SESSION['nearos'] = array(
        'guest' => true
    );

if(!isset($_GET['request']))
    die('Missing request');

$request = $_GET['request'];

function needsLoggedIn() {
    if(isset($_SESSION['nearos']['guest']) && $_SESSION['nearos']['guest']) {
        header('HTTP/1.0 403 Forbidden');
        die('You must be logged in !');
    }
}

function _logged() {
    die((isset($_SESSION['nearos']['guest']) && $_SESSION['nearos']['guest']) ? 'false' : 'true');
}

function _user_session() {
    die(json_encode($_SESSION['nearos']));
}

function _login($username, $password) {
    global $config;
    $userDir = 'users' . DS . $username;

    if(!preg_match('#^([a-zA-Z0-9_\-]+)$#', $username))
        die('Wrong username or password');

    if(!is_dir($userDir))
        die('Wrong username or password');

    if(!is_file($userDir . DS . 'user.sys'))
        die('Can\'t find user system informations. User account is corrupted. Please contact the webmaster.');

    try {
        $json = file_get_contents($userDir . DS . 'user.sys');
    }

    catch(Exception $e) {
        die('Can\'t read user system informations. Please try again.');
    }

    $json = json_decode($json, true);

    if(!$json)
        die('User system informations are corrupted. Please contact the webmaster.');

    if(!isset($json['password']))
        die('Can\'t find user password in system informations. Please contact the webmaster.');

    $password = hash_hmac($config['hash-algorithm'], $password, $password);

    if($json['password'] !== $password)
        die('Wrong username or password');

    $_SESSION['nearos'] = $json;
    $_SESSION['nearos']['username'] = $username;

    die('true');
}

function _readfile($file) {
    needsLoggedIn();
    $file = 'users' . DS . $_SESSION['nearos']['username'] . DS . normalizePath($file);

    if(!is_file($file)) {
        header("HTTP/1.0 404 Not Found");
        exit(0);
    } else {
        readfile($file);
        exit(0);
    }
}

function _write_plain_file($file, $content) {
    needsLoggedIn();
    $file = 'users' . DS . $_SESSION['nearos']['username'] . DS . normalizePath($file);

    try {
        file_put_contents($file, $content);
        die('true');
    }

    catch(Exception $e) {
        header($_SERVER['SERVER_PROTOCOL'] . ' 500 Internal Server Error', true, 500);
        die('Internal server error');
        exit(0);
    }
}

function _mkdir($dir) {
    $dir = 'users' . DS . $_SESSION['nearos']['username'] . DS . normalizePath($dir);

    if(is_dir($dir))
        die('true');

    try {
        mkdir($dir);
        die('true');
    }

    catch(Exception $e) {
        die('false');
    }
}

function _dir_exists($dir) {
    $dir = 'users' . DS . $_SESSION['nearos']['username'] . DS . normalizePath($dir);
    die(is_dir($dir) ? 'true' : 'false');
}

function _file_exists($file) {
    $file = 'users' . DS . $_SESSION['nearos']['username'] . DS . normalizePath($file);
    die(is_file($file) ? 'true' : 'false');
}

function _exists($path) {
    $path = 'users' . DS . $_SESSION['nearos']['username'] . DS . normalizePath($path);
    die(file_exists($path) ? 'true' : 'false');
}

$request = '_' . $request;

if(function_exists($request)) {
    $args = get_func_argNames($request);
    $callArgs = array();
    foreach($args as $i => $name) {
        if(!isset($_GET[$name]))
            die('Missing argument "' . $name . '" for request "' . substr($request, 1) . '"');

        $callArgs[] = $_GET[$name];
    }

    die(call_user_func_array($request, $callArgs));
} else
    die('Bad request');
