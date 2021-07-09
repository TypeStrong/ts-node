import assert from 'assert';

import shouldBeCjs from './src/should-be-cjs.ts';
import * as subdirEsm from './src/esm-subdir/index.ts';
import subdirCjs from './src/esm-subdir/cjs-exception.ts';

assert(shouldBeCjs.requireType === 'function');
assert(subdirEsm.requireType === 'undefined');
assert(subdirCjs.requireType === 'function');

console.log(`Failures: 0`);
