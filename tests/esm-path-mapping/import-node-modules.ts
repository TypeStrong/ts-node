// Should be able to import from node_modules
import someCjsDependency from 'some-cjs-dependency';
import someEsmDependency from 'some-esm-dependency';

const main = async (): Promise<void> => {
  // Pre-conditions
  const assert: any = await import('assert');
  if (typeof assert.strictEqual !== 'function')
    throw new Error('Pre-condition failed: assert could not be imported');

  // Assertions
  assert.strictEqual(someCjsDependency, 'export-from-some-cjs-dependency');
  assert.strictEqual(someEsmDependency, 'export-from-some-esm-dependency');
};

main();
