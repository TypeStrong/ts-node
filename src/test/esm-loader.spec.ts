// ESM loader hook tests
// TODO: at the time of writing, other ESM loader hook tests have not been moved into this file.
// Should consolidate them here.

import { context } from './testlib';
import semver = require('semver');
import {
  contextTsNodeUnderTest,
  EXPERIMENTAL_MODULES_FLAG,
  resetNodeEnvironment,
  TEST_DIR,
} from './helpers';
import { createExec } from './exec-helpers';
import { join } from 'path';
import * as expect from 'expect';
import type { NodeHooksAPI2 } from '../esm';

const nodeUsesNewHooksApi = semver.gte(process.version, '16.12.0');

const test = context(contextTsNodeUnderTest);

const exec = createExec({
  cwd: TEST_DIR,
});

test.suite('createEsmHooks', (test) => {
  if (semver.gte(process.version, '12.16.0')) {
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

test.suite('hooks', (_test) => {
  const test = _test.context(async (t) => {
    const service = t.context.tsNodeUnderTest.create({
       cwd: TEST_DIR
    });
    t.teardown(() => {
      resetNodeEnvironment();
    });
    return {
      service,
      hooks: t.context.tsNodeUnderTest.createEsmHooks(service),
    };
  });

  if (nodeUsesNewHooksApi) {
    test('Correctly determines format of data URIs', async (t) => {
      const { hooks } = t.context;
      const url = 'data:text/javascript,console.log("hello world");';
      const result = await (hooks as NodeHooksAPI2).load(
        url,
        { format: undefined },
        async (url, context, _ignored) => {
          return { format: context.format!, source: '' };
        }
      );
      expect(result.format).toBe('module');
    });
  }
});
