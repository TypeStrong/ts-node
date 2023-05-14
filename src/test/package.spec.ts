// Verify the shape of the published tarball:
// valid import specifiers
// CLI commands on PATH
// named exports

import { ctxTsNode, testsDirRequire } from './helpers';
import { context, expect } from './testlib';

const test = context(ctxTsNode);

test('should export the correct version', (t) => {
  expect(t.context.tsNodeUnderTest.VERSION).toBe(require('../../package.json').version);
});
test('should export all CJS entrypoints', () => {
  // Ensure our package.json "exports" declaration allows `require()`ing all our entrypoints
  // https://github.com/TypeStrong/ts-node/pull/1026

  testsDirRequire.resolve('ts-node');

  // only reliably way to ask node for the root path of a dependency is Path.resolve(require.resolve('ts-node/package'), '..')
  testsDirRequire.resolve('ts-node/package');
  testsDirRequire.resolve('ts-node/package.json');

  // All bin entrypoints for people who need to augment our CLI: `node -r otherstuff ./node_modules/ts-node/dist/bin`
  testsDirRequire.resolve('ts-node/dist/bin');
  testsDirRequire.resolve('ts-node/dist/bin.js');
  testsDirRequire.resolve('ts-node/dist/bin-transpile');
  testsDirRequire.resolve('ts-node/dist/bin-transpile.js');
  testsDirRequire.resolve('ts-node/dist/bin-script');
  testsDirRequire.resolve('ts-node/dist/bin-script.js');
  testsDirRequire.resolve('ts-node/dist/bin-cwd');
  testsDirRequire.resolve('ts-node/dist/bin-cwd.js');

  // Must be `require()`able obviously
  testsDirRequire.resolve('ts-node/register');
  testsDirRequire.resolve('ts-node/register/files');
  testsDirRequire.resolve('ts-node/register/transpile-only');
  testsDirRequire.resolve('ts-node/register/type-check');

  // `node --loader ts-node/esm`
  testsDirRequire.resolve('ts-node/esm');
  testsDirRequire.resolve('ts-node/esm.mjs');
  testsDirRequire.resolve('ts-node/esm/transpile-only');
  testsDirRequire.resolve('ts-node/esm/transpile-only.mjs');

  testsDirRequire.resolve('ts-node/transpilers/swc');
  testsDirRequire.resolve('ts-node/transpilers/swc-experimental');

  testsDirRequire.resolve('ts-node/node14/tsconfig.json');
  testsDirRequire.resolve('ts-node/node16/tsconfig.json');
  testsDirRequire.resolve('ts-node/node18/tsconfig.json');
  testsDirRequire.resolve('ts-node/node20/tsconfig.json');
});
