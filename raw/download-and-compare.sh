#!/usr/bin/env bash
set -euo pipefail
shopt -s inherit_errexit
__dirname="$(CDPATH= cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$__dirname"

# This script serves as helpful documentation for where these files came from.

# TODO augment this script to update esm-resolver-diff branch
# https://github.com/TypeStrong/ts-node/compare/esm-resolver-diff..main

function download() {
  echo "// Copied from https://github.com/nodejs/node/blob/$version/$path$ext"$'\n' > "$local-$version$ext"
  curl "https://raw.githubusercontent.com/nodejs/node/$version/$path$ext" >> "$local-$version$ext"
}
compare() {
  diff "$local-$version$ext" "../dist-raw/$local$ext" || true
}
assertStrippedIsOnlyDeletions() {
  [ "$( diff "$1.js" "$1-stripped.js" | grep -E '^>' )" = '' ]
}

ext=.js

####

path=lib/internal/modules/cjs/loader
local=node-internal-modules-cjs-loader
version=v17.0.1
download
# compare

version=v15.3.0
download
# compare

version=2d5d77306f6dff9110c1f77fefab25f973415770
download
# compare

####

path=lib/internal/modules/cjs/helpers
local=node-internal-modules-cjs-helpers
version=v17.0.1
download
# compare

####

path=lib/internal/modules/esm/resolve
local=node-internal-modules-esm-resolve
version=v13.12.0
download
# compare

version=v15.3.0
download
# compare

####

path=lib/internal/modules/esm/get_format
local=node-internal-modules-esm-get_format
version=v15.3.0
download
# compare

####

path=lib/internal/repl/await
local=node-internal-repl-await
version=v17.0.0
download
# compare

version=88799930794045795e8abac874730f9eba7e2300
download
# compare

####

path=lib/internal/modules/package_json_reader
local=node-internal-modules-package_json_reader
version=v15.3.0
download
# compare

####

path=lib/internal/errors
local=node-internal-errors
version=2d5d77306f6dff9110c1f77fefab25f973415770
download
# compare

version=b533fb3508009e5f567cc776daba8fbf665386a6
download
# compare

####

# Verify that -stripped.js files have only deletions, no other changes
set -x

assertStrippedIsOnlyDeletions node-internal-modules-cjs-loader-v15.3.0
assertStrippedIsOnlyDeletions node-internal-modules-cjs-loader-v17.0.1
assertStrippedIsOnlyDeletions node-internal-modules-cjs-helpers-v17.0.1
assertStrippedIsOnlyDeletions node-internal-modules-esm-resolve-v15.3.0
assertStrippedIsOnlyDeletions node-internal-errors-2d5d77306f6dff9110c1f77fefab25f973415770
assertStrippedIsOnlyDeletions node-internal-errors-b533fb3508009e5f567cc776daba8fbf665386a6
