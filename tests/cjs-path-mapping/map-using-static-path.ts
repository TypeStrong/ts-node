// Should map to static path (no wildcard)
const immobile = require('static');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(immobile, 'immobile');

// Force this to be a module
export {};
