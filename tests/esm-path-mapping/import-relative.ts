// Should be able to use relative imports
import aboveBaseJs from './level-1/above-base-js';
import aboveBaseJsx from '../cjs-path-mapping/level-1/above-base-jsx';
import aboveBaseTs from '/level-1/above-base-ts';

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(aboveBaseJs, 'above-base-js');
assert.strictEqual(aboveBaseJsx, 'above-base-jsx');
assert.strictEqual(aboveBaseTs, 'above-base-ts');

// Force this to be a module
export {};
