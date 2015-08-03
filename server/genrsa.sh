#!/bin/bash

if [ -z $1 ]
then
    read -p "RSA key length (recommanded: 4096) ? " length
else
    length=$1
fi

openssl genrsa -out rsa-private-$length.pem $length
openssl rsa -pubout -in rsa-private-$length.pem -out rsa-public-$length.pem

cat rsa-private-$length.pem > rsa-private-$length.key
cat rsa-public-$length.pem > rsa-public-$length.key

rm rsa-private-$length.pem
rm rsa-public-$length.pem

echo
echo
echo The key has been generated.
echo Please open \"user.php\" and replace the third line of the file by this one \:
echo
echo \$RSAKeyLength = $length\;
