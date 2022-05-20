// Should be able to use path to map to js, jsx, tsx
const mappedJs = require('mapped/js');
const mappedJsx = require('mapped/jsx');
const mappedTsx = require('mapped/tsx');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(mappedJs, 'mapped-js');
assert.strictEqual(mappedJsx, 'mapped-jsx');
assert.strictEqual(mappedTsx, 'mapped-tsx');

// Force this to be a module
export {};
