// Should map using the more specific path
// ❌ "candidate/*": ["./candidate-1-*", "./candidate-2-*"] => ./candidate-1-foo/bar
// ✅ "candidate/foo/*": ["./candidate-foo-*"] => ./candidate-foo-bar
const fooBar = require('candidate/foo/bar');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(fooBar, 'candidate-foo-bar');

// Force this to be a module
export {};
