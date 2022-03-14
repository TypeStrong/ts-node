import * as assert from 'assert';

// Import js, jsx, ts at baseUrl
import baseJs from 'js.js';
import baseJsx from 'jsx.jsx';
import baseTs from 'ts.js';

// Import js, jsx, ts under baseUrl
import childJs from 'child/js.js';
import childJsx from 'child/jsx.jsx';
import childTs from 'child/ts.js';

assert.strictEqual(baseJs, 'base/js');
assert.strictEqual(baseJsx, 'base/jsx');
assert.strictEqual(baseTs, 'base/ts');

assert.strictEqual(childJs, 'base/child/js');
assert.strictEqual(childJsx, 'base/child/jsx');
assert.strictEqual(childTs, 'base/child/ts');
