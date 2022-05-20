// Should map to the first path pattern that exists
const foo = require('candidate/foo');
const bar = require('candidate/bar');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(foo, 'candidate-1-foo');
assert.strictEqual(bar, 'candidate-2-bar');

// Force this to be a module
export {};
