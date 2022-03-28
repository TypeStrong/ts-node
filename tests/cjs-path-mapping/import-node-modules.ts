// Do not extract this helper - it will change the meaning of relative imports
const importDefaultHelper = new Function(
  'specifier',
  'return import(specifier).then(mod => mod.default)'
);

const main = async (): Promise<void> => {
  // Should be able to import from node_modules
  const someCjsDependency = require('some-cjs-dependency');
  const someEsmDependency = await importDefaultHelper('some-esm-dependency');

  // Pre-conditions
  const assert = require('assert');

  // Assertions
  assert.strictEqual(someCjsDependency, 'export-from-some-cjs-dependency');
  assert.strictEqual(someEsmDependency, 'export-from-some-esm-dependency');
};

main();

// Force this to be a module
export {};
