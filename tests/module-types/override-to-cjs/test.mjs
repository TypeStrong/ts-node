import assert from 'assert';

import webpackConfig from './webpack.config.ts';
import * as shouldBeEsm from './src/should-be-esm.ts';
import subdirCjs from './src/cjs-subdir/index.ts';
import * as subdirEsm from './src/cjs-subdir/esm-exception.ts';

assert(webpackConfig.hello === 'world');
assert(shouldBeEsm.requireType === 'undefined');
assert(subdirCjs.requireType === 'function');
assert(subdirEsm.requireType === 'undefined');

console.log(`Failures: 0`);
