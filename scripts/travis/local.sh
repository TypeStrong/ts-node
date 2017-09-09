#!/usr/bin/env bash

set -e

export LOCAL="yes"

cp -R /repo /build
cd /build

curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.4/install.sh | bash
. "${HOME}/.nvm/nvm.sh"
nvm install 8
npm run build

mkdir /tests
gem install wwtd
wwtd ${@}
