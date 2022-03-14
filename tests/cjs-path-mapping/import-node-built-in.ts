// Should be able to import node built-ins
const assert = require('assert');
const { stat } = require('fs');

if (typeof assert.strictEqual !== 'function')
  throw new Error('Failed to import `assert`');
assert.strictEqual(typeof stat, 'function');
