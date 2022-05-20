// Should import below base directory
import belowBaseJs from 'level-3/below-base-js.js';
import belowBaseJsx from 'level-3/below-base-jsx.js';
import belowBaseTs from 'level-3/below-base-ts.js';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(belowBaseJs, 'below-base-js');
assert.strictEqual(belowBaseJsx, 'below-base-jsx');
assert.strictEqual(belowBaseTs, 'below-base-ts');
