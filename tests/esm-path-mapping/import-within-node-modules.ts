// Should ignore paths when importing inside node_modules
import dependsOnLodash from 'depends-on-lodash';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(dependsOnLodash.proxyLodash, 'lodash'); // not our 'lodash-local'
