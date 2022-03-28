// Should ignore local ambient.d.ts
const ambient = require('ambient');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(ambient, 'ambient'); // not our 'local-ambient'

// Force this to be a module
export {};
