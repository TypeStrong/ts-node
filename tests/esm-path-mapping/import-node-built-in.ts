// Should be able to import node built-ins
import * as assert from 'assert';
import { stat } from 'fs';

if (typeof assert.strictEqual !== 'function')
  throw new Error('Pre-condition failed: assert could not be imported');
assert.strictEqual(typeof stat, 'function');
