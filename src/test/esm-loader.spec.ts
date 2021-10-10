// ESM loader hook tests
// TODO: at the time of writing, other ESM loader hook tests have not been moved into this file.
// Should consolidate them here.

import { test } from './testlib';
import semver = require('semver');
import { EXPERIMENTAL_MODULES_FLAG, TEST_DIR } from './helpers';
import { createExec } from './exec-helpers';
import { join } from 'path';
import * as expect from 'expect';

const exec = createExec({
  cwd: TEST_DIR,
});

test.suite('createEsmHooks', (test) => {
  if (semver.gte(process.version, '12.0.0')) {
    test('should create proper hooks with provided instance', async () => {
      const { err } = await exec(
        `node ${EXPERIMENTAL_MODULES_FLAG} --loader ./loader.mjs index.ts`,
        {
          cwd: join(TEST_DIR, './esm-custom-loader'),
        }
      );

      if (err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(err.message).toMatch(/TS6133:\s+'unusedVar'/);
    });
  }
});
