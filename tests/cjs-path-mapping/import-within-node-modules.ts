// Should ignore paths when importing inside node_modules
import dependsOnLodash = require('depends-on-lodash');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(dependsOnLodash.proxyLodash, 'lodash'); // not our 'lodash-local'

// Force this to be a module
export {};
