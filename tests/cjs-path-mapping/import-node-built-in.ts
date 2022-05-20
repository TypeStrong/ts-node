// Should be able to import node built-ins
const assert = require('assert');
const { stat } = require('fs');

// Assertions
assert.strictEqual(typeof stat, 'function');

// Force this to be a module
export {};
