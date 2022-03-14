import * as assert from 'assert';
import { stat } from 'fs';

assert.strictEqual(typeof stat, 'function');
