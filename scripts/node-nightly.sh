#!/usr/bin/env bash

# Hacky script to grab node nightly and plonk it into node_modules/.bin, for
# locally testing against nightly builds.

set -euo pipefail
shopt -s inherit_errexit
__dirname="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$__dirname/.."

set -x

mkdir -p tmp

version=$(curl https://nodejs.org/download/nightly/index.json | jq -r '.[0].version')
[ -e "tmp/$version.tar.xz" ] || \
  curl -o "tmp/$version.tar.xz" "https://nodejs.org/download/nightly/$version/node-$version-linux-x64.tar.xz"

[ -e "tmp/$version.tar" ] || \
  unxz "tmp/$version.tar.xz"

{
  cd tmp
  tar -xvf "$version.tar"
}

ln -s "../../tmp/node-$version-linux-x64/bin/node" ./node_modules/.bin/node
