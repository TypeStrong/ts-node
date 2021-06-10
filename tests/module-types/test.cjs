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
assert(cjsSubdir.cjs === true);

console.log(`Failures: ${failures}`);
