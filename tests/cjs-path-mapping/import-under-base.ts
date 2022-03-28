// Should import under base directory
const underBaseJs = require('level-3/under-base-js.js');
const underBaseJsx = require('level-3/under-base-jsx.js');
const underBaseTs = require('level-3/under-base-ts.js');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(underBaseJs, 'under-base-js');
assert.strictEqual(underBaseJsx, 'under-base-jsx');
assert.strictEqual(underBaseTs, 'under-base-ts');

// Force this to be a module
export {};
