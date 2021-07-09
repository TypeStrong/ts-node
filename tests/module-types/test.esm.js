import assert from 'assert';

import cjsSubdirCJS from './src/cjs-subdir/index.ts';
import cjsSubdirESM from './src/cjs-subdir/esm-exception/index.ts';

assert(cjsSubdirCJS.requireType === 'function');
assert(cjsSubdirESM.requireType === 'undefined');
