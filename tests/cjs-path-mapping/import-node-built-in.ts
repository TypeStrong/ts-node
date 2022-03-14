// Should be able to import node built-ins
import * as assert from 'assert';
import { stat } from 'fs';

if (typeof assert.strictEqual !== 'function')
  throw new Error('Failed to import `assert`');
assert.strictEqual(typeof stat, 'function');
