#!/usr/bin/env bash
set -euo pipefail
shopt -s inherit_errexit
__dirname="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$__dirname"
set -x

# This script serves as helpful documentation for where these files came from.

function download() {
  echo "// Copied from https://github.com/nodejs/node/blob/$version/$path$ext"$'\n' > "$local-$version$ext"
  curl "https://raw.githubusercontent.com/nodejs/node/$version/$path$ext" >> "$local-$version$ext"
}
compare() {
  diff "$local-$version$ext" "../dist-raw/$local$ext" || true
}

ext=.js

####

path=lib/internal/modules/cjs/loader
local=node-internal-modules-cjs-loader
version=v17.0.1
download
compare

version=v15.3.0
download
compare

version=2d5d77306f6dff9110c1f77fefab25f973415770
download
compare

####

path=lib/internal/modules/esm/resolve
local=node-internal-modules-esm-resolve
version=v13.12.0
download
compare

version=v15.3.0
download
compare

####

path=lib/internal/repl/await
local=node-internal-repl-await
version=v17.0.0
download
compare

version=88799930794045795e8abac874730f9eba7e2300
download
compare

####
