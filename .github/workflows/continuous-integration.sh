#!/usr/bin/env bash
set -euo pipefail

npm install
npm run build
npm rm tslint
npm install "$matrix_typescript"

# Test and capture exit code
set +e
npm run test-cov
exit_code="$?"
set -e

# Report coverage
npm install coveralls@2
cat ./coverage/lcov.info | ./node_modules/.bin/coveralls

exit "$exit_code"