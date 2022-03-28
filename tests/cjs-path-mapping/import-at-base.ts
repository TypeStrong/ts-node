// Should import from base directory
const atBaseJs = require('at-base-js.js');
const atBaseJsx = require('at-base-jsx.jsx');
const atBaseTs = require('at-base-ts.js');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(atBaseJs, 'at-base-js');
assert.strictEqual(atBaseJsx, 'at-base-jsx');
assert.strictEqual(atBaseTs, 'at-base-ts');

// Force this to be a module
export {};
