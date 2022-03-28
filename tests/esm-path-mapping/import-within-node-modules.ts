// Should ignore paths when importing inside node_modules
import { proxyLodash } from 'depends-on-lodash';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(proxyLodash, 'lodash'); // not our 'lodash-local'
