import * as assert from 'assert';

// Fallback to built-in
import { stat } from 'fs';

assert.strictEqual(typeof stat, 'function');
