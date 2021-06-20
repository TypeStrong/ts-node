import assert from 'assert';

import cjsSubdirCJS from './src/cjs-subdir';
import cjsSubdirESM from './src/cjs-subdir/esm-exception';

assert(cjsSubdirCJS.requireType === 'function');
assert(cjsSubdirESM.requireType === 'undefined');
