<?php

$RSAKeyLength = 4096;

session_start();
ob_start();

require 'config.php';
require 'aes.class.php';
require 'aes-ctr.class.php';

$privateRSAKey = file_get_contents('rsa-private-' . $RSAKeyLength . '.key');
$publicRSAKey  = file_get_contents('rsa-public-' . $RSAKeyLength . '.key');

include('Crypt/RSA.php');

function AES_Encrypt($plaintext, $key, $bytes = 256) {
    return AesCtr::encrypt($plaintext, $key, $bytes);
}

function AES_Decrypt($ciphertext, $key, $bytes = 256) {
    return AesCtr::decrypt($ciphertext, $key, $bytes);
}

function RSA_Encrypt($plaintext, $publicKey) {
    $rsa = new Crypt_RSA();
    $rsa->loadKey($publicKey);
    $rsa->setEncryptionMode(CRYPT_RSA_ENCRYPTION_PKCS1);
    return base64_encode($rsa->encrypt($plaintext));
}

function RSA_Decrypt($ciphertext, $privateKey) {
    // if $ciphertext come from pidCrypt.JS, then the result of RSA_Decrypt is in base64 format
    $rsa = new Crypt_RSA();
    $rsa->loadKey($privateKey);
    $ciphertext = str_replace(array("\r","\n", ' '), '', $ciphertext);
    $ciphertext = base64_decode($ciphertext);
    $rsa->setEncryptionMode(CRYPT_RSA_ENCRYPTION_PKCS1);
    return $rsa->decrypt($ciphertext);
}

/*--------------------------*/

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

function formatPath($path) {
    $path = 'users' . DS . $_SESSION['nearos']['username'] . DS . normalizePath($path);
    $path = str_replace('/', DS, $path);
    $path = str_replace('\\', DS, $path);
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

if(count($_GET))
    $_POST = $_GET;

if(!isset($_SESSION['nearos']))
    $_SESSION['nearos'] = array(
        'guest' => true
    );

if(!isset($_POST['request']))
    died('Missing request');

$request = $_POST['request'];

function needsLoggedIn() {
    if(isset($_SESSION['nearos']['guest']) && $_SESSION['nearos']['guest']) {
        header('HTTP/1.0 403 Forbidden');
        died('You must be logged in !');
    }
}

function died($msg = '') {
    global $request;
    $msg = ob_get_clean() . $msg;

    if((isset($_SESSION['nearos']['guest']) && $_SESSION['nearos']['guest']) || $request === 'login' || $request === '_login' || empty($_SESSION['nearos']['aes'])) {
        // not logged in
        die($msg);
    } else {
        // logged in
        die(AES_Encrypt($msg, $_SESSION['nearos']['aes']));
    }
}

function _logged() {
    died((isset($_SESSION['nearos']['guest']) && $_SESSION['nearos']['guest']) ? 'false' : 'true');
}

function _user_session() {
    died(json_encode($_SESSION['nearos']));
}

function _login($username, $password, $aeskey) {
    global $config;
    global $privateRSAKey;

    $userDir = 'users' . DS . $username;

    if(!preg_match('#^([a-zA-Z0-9_\-]+)$#', $username))
        died('Wrong username or password');

    if(!is_dir($userDir))
        died('Wrong username or password');

    if(!is_file($userDir . DS . '.system'))
        died('Can\'t find user system informations. User account is corrupted. Please contact the webmaster.');

    try {
        $json = file_get_contents($userDir . DS . '.system');
    }

    catch(Exception $e) {
        died('Can\'t read user system informations. Please try again.');
    }

    $json = json_decode($json, true);

    if(!$json)
        died('User system informations are corrupted. Please contact the webmaster.');

    if(!isset($json['password']))
        died('Can\'t find user password in system informations. Please contact the webmaster.');

    $password = hash_hmac($config['hash-algorithm'], $password, $password);

    if($json['password'] !== $password)
        died('Wrong username or password');

    $_SESSION['nearos'] = $json;
    $_SESSION['nearos']['username'] = $username;

    if(!empty($aeskey)) {
        $_SESSION['nearos']['aes'] = base64_decode(RSA_decrypt($aeskey, $privateRSAKey));
    } else {
        $_SESSION['nearos']['aes'] = '';
    }

    died('true');
}

function _touchfile($path) {
    needsLoggedIn();
    $path = formatPath($path);
    fopen($path, 'w');
    died('true');
}

function _readfile($path, $asIs, $download) {
    needsLoggedIn();
    $path = formatPath($path);

    if(!is_file($path)) {
        header("HTTP/1.0 404 Not Found");
        exit(0);
    } else {
        if($asIs === 'true') {
            readfile($path);

            if($download === 'true') {
                header('Content-Type: application/octet-stream');
                header("Content-Transfer-Encoding: Binary");
                header("Content-disposition: attachment; filename=\"" . basename($path) . "\"");
            }

            exit(0);
        } else
            died(file_get_contents($path));
    }
}

function _write_plain_file($path, $content) {
    needsLoggedIn();
    $path = formatPath($path);

    try {
        file_put_contents($path, $content);
        died('true');
    }

    catch(Exception $e) {
        header($_SERVER['SERVER_PROTOCOL'] . ' 500 Internal Server Error', true, 500);
        died('Internal server error');
        exit(0);
    }
}

function _remove_file($path) {
    needsLoggedIn();
    $path = formatPath($path);

    if(!is_file($path))
        died('false');

    try {
        unlink($path);
        died('true');
    }

    catch(Exception $e) {
        died('false');
    }
}

function _mkdir($path) {
    needsLoggedIn();
    $path = formatPath($path);

    if(is_dir($path))
        died('true');

    try {
        mkdir($path);
        died('true');
    }

    catch(Exception $e) {
        died('false');
    }
}

function _read_dir($path) {
    needsLoggedIn();
    $path = formatPath($path);

    if(!is_dir($path))
        died('false');

    $dh = opendir($path);
    $paths = array();

    while (false !== ($pathname = readdir($dh))) {
        if($pathname !== '.' && $pathname !== '..')
            $paths[] = $pathname;
    }

    sort($paths);

    died(json_encode($paths));
}

function _read_dir_files($path) {
    needsLoggedIn();
    $path = formatPath($path);

    if(!is_dir($path))
        died('false');

    $dh = opendir($path);
    $paths = array();

    while (false !== ($pathname = readdir($dh))) {
        if($pathname !== '.' && $pathname !== '..' && is_file($path . DS . $pathname))
            $paths[] = $pathname;
    }

    sort($paths);

    died(json_encode($paths));
}

function _read_dir_dirs($path) {
    needsLoggedIn();
    $path = formatPath($path);

    if(!is_dir($path))
        died('false');

    $dh = opendir($path);
    $paths = array();

    while (false !== ($pathname = readdir($dh))) {
        if($pathname !== '.' && $pathname !== '..' && is_dir($path . DS . $pathname))
            $paths[] = $pathname;
    }

    sort($paths);

    died(json_encode($paths));
}

function _rename($path, $newPath) {
    needsLoggedIn();
    $path = formatPath($path);
    $newPath = formatPath($newPath);

    if(!file_exists($path))
        died('Source doesn\'t exists !');

    if(file_exists($newPath))
        died('Source already exists !');

    try {
        rename($path, $newPath);
        died('true');
    }

    catch(Exception $e) {
        died('Failed to rename');
    }
}

function _dir_exists($path) {
    needsLoggedIn();
    $path = formatPath($path);
    died(is_dir($path) ? 'true' : 'false');
}

function _file_exists($path) {
    needsLoggedIn();
    $path = formatPath($path);
    died(is_file($path) ? 'true' : 'false');
}

function _exists($path) {
    needsLoggedIn();
    $path = formatPath($path);
    died(file_exists($path) ? 'true' : 'false');
}

if(isset($_SESSION['nearos']) && isset($_SESSION['nearos']['aes']) && !empty($_SESSION['nearos']['aes']) && $request !== 'login')
    $request = '_' . AES_Decrypt($request, $_SESSION['nearos']['aes']);
else
    $request = '_' . $request;

if(function_exists($request)) {
    $args = get_func_argNames($request);
    $callArgs = array();

    if($request === '_login' && !isset($_POST['aeskey']))
        $_POST['aeskey'] = '';

    foreach($args as $i => $name) {
        if(!isset($_POST[$name]))
            died('Missing argument "' . $name . '" for request "' . substr($request, 1) . '"');

        $callArgs[] = (isset($_SESSION['nearos']) && isset($_SESSION['nearos']['aes']) && !empty($_SESSION['nearos']['aes']) && $request !== '_login')
                     ? AES_Decrypt($_POST[$name], $_SESSION['nearos']['aes'])
                     : $_POST[$name];
    }

    died(call_user_func_array($request, $callArgs));
} else
    died('Bad request');
