import * as assert from 'assert';

// Import js, jsx, ts at baseUrl
import baseJs from '1-js.js';
import baseJsx from '2-jsx.js';
import baseTs from '3-ts.js';

// Import js, jsx, ts under baseUrl
import childJs from 'child/1-js.js';
import childJsx from 'child/2-jsx.js';
import childTs from 'child/3-ts.js';

assert.strictEqual(baseJs, 'base/js');
assert.strictEqual(baseJsx, 'base/jsx');
assert.strictEqual(baseTs, 'base/ts');

assert.strictEqual(childJs, 'base/child/js');
assert.strictEqual(childJsx, 'base/child/jsx');
assert.strictEqual(childTs, 'base/child/ts');
