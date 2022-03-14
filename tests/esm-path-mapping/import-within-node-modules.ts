// Pre-conditions
import * as assert from 'assert';
if (typeof assert.strictEqual !== 'function')
  throw new Error('Pre-condition failed: assert could not be imported');

// Should ignore paths when importing inside node_modules
import dependsOnLodash from 'depends-on-lodash';

assert.strictEqual(dependsOnLodash.proxyLodash, 'lodash'); // not our 'lodash-local'
