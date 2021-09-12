const assert = require('assert');

const wpc = require('./webpack.config.ts');
assert(wpc.hello === 'world');

let failures = 0;

try {
  require('./src/should-be-esm.ts');
  failures++;
} catch (e) {
  // good
}

const cjsSubdir = require('./src/cjs-subdir');
assert(cjsSubdir.requireType === 'function');

try {
  require('./src/cjs-subdir/esm-exception.ts');
  failures++;
} catch (e) {
  // good
}

console.log(`Failures: ${failures}`);
