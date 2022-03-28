// Should be able to use path to map import
const mappedTs = require('mapped/ts');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(mappedTs, 'mapped-ts');

// Force this to be a module
export {};
