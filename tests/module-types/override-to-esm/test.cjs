const assert = require('assert');

let failures = 0;

const shouldBeCjs = require('./src/should-be-cjs.ts');
assert(shouldBeCjs.requireType === 'function');

try {
  require('./src/esm-subdir');
  failures++;
} catch (e) {
  // good
}

const cjsException = require('./src/esm-subdir/cjs-exception.ts');
assert(cjsException.requireType === 'function');

console.log(`Failures: ${failures}`);
