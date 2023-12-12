#!/bin/bash

profileColor=$1
profileDescription=$2
profileMoldType=$3

# include exitOnFailure function
myScriptDir=`dirname $0`
. $myScriptDir/exitOnFailure.sh

# set desired properties in our config file
cp $myScriptDir/banana.config.json .
exitOnFailure "Failed to copy config file." $?

sed -e "s/NoColorVal/$profileColor/" \
    -e "s/NoDescriptionVal/$profileDescription/" \
    -e "s/NoMoldTypeVal/$profileMoldType/" \
    < banana.config.json > cmd-cli.config.json
exitOnFailure "Failed to update config file." $?

cmd-cli profile mapping-positional
exitOnFailure "The 'profile mapping-positional' command failed." $?
