// Should be able to import from node_modules
import someCjsDependency = require('some-cjs-dependency');
// TODO: Import an ESM dep statically or...
// import someEsmDependency from 'some-esm-dependency'

const main = async (): Promise<void> => {
  // TODO: ...or dynamically
  // const someEsmDependency = await import('some-esm-dependency');

  // Pre-conditions
  const assert: any = require('assert');

  // Assertions
  assert.strictEqual(someCjsDependency, 'export-from-some-cjs-dependency');
  // assert.strictEqual(someEsmDependency, 'export-from-some-esm-dependency');
};

main();
