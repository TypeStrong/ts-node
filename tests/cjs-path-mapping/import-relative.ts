// Should be able to use relative imports
const aboveBaseJs = require('./level-1/above-base-js');
const aboveBaseJsx = require('../cjs-path-mapping/level-1/above-base-jsx');
// const aboveBaseTs = require('/level-1/above-base-ts');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(aboveBaseJs, 'above-base-js');
assert.strictEqual(aboveBaseJsx, 'above-base-jsx');
// assert.strictEqual(aboveBaseTs, 'above-base-ts');

// Force this to be a module
export {};
