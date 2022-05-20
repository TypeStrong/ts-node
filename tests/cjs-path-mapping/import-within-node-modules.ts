// Should ignore paths when importing inside node_modules
const { proxyLodash } = require('depends-on-lodash');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(proxyLodash, 'lodash'); // not our 'lodash-local'

// Force this to be a module
export {};
