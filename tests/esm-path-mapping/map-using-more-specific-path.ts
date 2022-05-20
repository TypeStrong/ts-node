// Should map using the more specific path
// ❌ "candidate/*": ["./candidate-1-*", "./candidate-2-*"] => ./candidate-1-foo/bar
// ✅ "candidate/foo/*": ["./candidate-foo-*"] => ./candidate-foo-bar
import fooBar from 'candidate/foo/bar.js';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(fooBar, 'candidate-foo-bar');
