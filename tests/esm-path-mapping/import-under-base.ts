// Should import under base directory
import underBaseJs from 'level-3/under-base-js.js';
import underBaseJsx from 'level-3/under-base-jsx.js';
import underBaseTs from 'level-3/under-base-ts.js';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(underBaseJs, 'under-base-js');
assert.strictEqual(underBaseJsx, 'under-base-jsx');
assert.strictEqual(underBaseTs, 'under-base-ts');
