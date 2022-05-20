// Should be able to import node built-ins
import * as assert from 'assert';
import { stat } from 'fs';

// Assertions
assert.strictEqual(typeof stat, 'function');
