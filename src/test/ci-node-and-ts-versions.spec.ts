// When running on CI, double-check that we are testing against the versions of node
// and typescript in the test matrix.

import semver = require('semver');
import { ctxTsNode } from './helpers';
import { context, expect } from './testlib';

const test = context(ctxTsNode);
test.suite('Confirm node and typescript versions on CI', (test) => {
  test.runIf(!!process.env.CI);
  test('node version is correct', async (t) => {
    expect(process.env.TEST_MATRIX_NODE_VERSION).toBeDefined();
    expect(
      semver.satisfies(
        process.versions.node,
        process.env.TEST_MATRIX_NODE_VERSION!
      )
    ).toBe(true);
  });
  test('typescript version is correct', async (t) => {
    expect(process.env.TEST_MATRIX_TYPESCRIPT_VERSION).toBeDefined();
    expect(
      semver.satisfies(
        t.context.tsNodeUnderTest.VERSION,
        process.env.TEST_MATRIX_TYPESCRIPT_VERSION!
      )
    ).toBe(true);
  });
});
