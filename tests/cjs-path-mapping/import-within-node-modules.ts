// Pre-conditions
const assert = require('assert');
if (typeof assert.strictEqual !== 'function')
  throw new Error('Pre-condition failed: assert could not be imported');

// Act: import a dependency with transitive dependencies
const { proxyLodash } = require('depends-on-lodash');

assert.strictEqual(proxyLodash, 'lodash'); // not our 'lodash-local'
