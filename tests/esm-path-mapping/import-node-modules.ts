// Using helper to maintain similarity with CJS test
const importDefaultHelper = async (specifier: string) =>
  await import(specifier).then((mod) => mod.default);

const main = async (): Promise<void> => {
  // Should be able to import from node_modules
  const someCjsDependency = await importDefaultHelper('some-cjs-dependency');
  const someEsmDependency = await importDefaultHelper('some-esm-dependency');

  // Pre-conditions
  const assert: any = await import('assert');

  // Assertions
  assert.strictEqual(someCjsDependency, 'export-from-some-cjs-dependency');
  assert.strictEqual(someEsmDependency, 'export-from-some-esm-dependency');
};

main();
