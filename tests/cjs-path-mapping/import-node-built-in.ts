// Should be able to import node built-ins
const assert = require('assert');
const { stat } = require('fs');

if (typeof assert.strictEqual !== 'function')
  throw new Error('Pre-condition failed: assert could not be imported');
assert.strictEqual(typeof stat, 'function');
