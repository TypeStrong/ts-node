// Should ignore local ambient.d.ts
import ambient = require('ambient');

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(ambient, 'ambient'); // not our 'local-ambient'
