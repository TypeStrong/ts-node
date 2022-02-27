import * as assert from 'assert';

// Import should ignore .d.ts
import ambient from 'ambient';

assert.strictEqual(ambient, 'ambient');
