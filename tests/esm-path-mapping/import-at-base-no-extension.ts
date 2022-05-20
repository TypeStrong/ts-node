// Should import from base directory, assuming file extension
import atBaseJs from 'at-base-js';
import atBaseJsx from 'at-base-jsx';
import atBaseTs from 'at-base-ts';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(atBaseJs, 'at-base-js');
assert.strictEqual(atBaseJsx, 'at-base-jsx');
assert.strictEqual(atBaseTs, 'at-base-ts');
