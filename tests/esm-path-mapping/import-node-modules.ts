// Should be able to import from node_modules
import someCjsDependency from 'some-cjs-dependency';
import someEsmDependency from 'some-esm-dependency';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(someCjsDependency, 'export-from-some-cjs-dependency');
assert.strictEqual(someEsmDependency, 'export-from-some-esm-dependency');
