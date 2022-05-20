// Should map to the first path pattern that exists
import foo from 'candidate/foo.js';
import bar from 'candidate/bar.js';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(foo, 'candidate-1-foo');
assert.strictEqual(bar, 'candidate-2-bar');
