// Should import from base directory
import atBaseJs from 'at-base-js.js';
import atBaseJsx from 'at-base-jsx.js';
import atBaseTs from 'at-base-ts.js';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(atBaseJs, 'at-base-js');
assert.strictEqual(atBaseJsx, 'at-base-jsx');
assert.strictEqual(atBaseTs, 'at-base-ts');
