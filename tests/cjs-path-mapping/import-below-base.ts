// Should import below base directory
const belowBaseJs = require('level-3/below-base-js.js');
const belowBaseJsx = require('level-3/below-base-jsx.js');
const belowBaseTs = require('level-3/below-base-ts.js');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(belowBaseJs, 'below-base-js');
assert.strictEqual(belowBaseJsx, 'below-base-jsx');
assert.strictEqual(belowBaseTs, 'below-base-ts');

// Force this to be a module
export {};
