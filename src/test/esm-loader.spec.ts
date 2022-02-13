// ESM loader hook tests
// TODO: at the time of writing, other ESM loader hook tests have not been moved into this file.
// Should consolidate them here.

import { context } from './testlib';
import semver = require('semver');
import {
  CMD_ESM_LOADER_WITHOUT_PROJECT,
  contextTsNodeUnderTest,
  EXPERIMENTAL_MODULES_FLAG,
  resetNodeEnvironment,
  TEST_DIR,
} from './helpers';
import { createExec } from './exec-helpers';
import { join, resolve } from 'path';
import * as expect from 'expect';
import type { NodeLoaderHooksAPI2 } from '../';

const nodeUsesNewHooksApi = semver.gte(process.version, '16.12.0');
const nodeSupportsImportAssertions = semver.gte(process.version, '17.1.0');

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
      cwd: TEST_DIR,
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
      const result = await (hooks as NodeLoaderHooksAPI2).load(
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

if (nodeSupportsImportAssertions) {
  test.suite('Supports import assertions', (test) => {
    test('Can import JSON using the appropriate flag and assertion', async (t) => {
      const { err, stdout } = await exec(
        `${CMD_ESM_LOADER_WITHOUT_PROJECT} --experimental-json-modules ./importJson.ts`,
        {
          cwd: resolve(TEST_DIR, 'esm-import-assertions'),
        }
      );
      expect(err).toBe(null);
      expect(stdout.trim()).toBe(
        'A fuchsia car has 2 seats and the doors are open.\nDone!'
      );
    });
  });

  test.suite("Catch unexpected changes to node's loader context", (test) => {
    /*
     * This does not test ts-node.
     * Rather, it is meant to alert us to potentially breaking changes in node's
     * loader API.  If node starts returning more or less properties on `context`
     * objects, we want to know, because it may indicate that our loader code
     * should be updated to accomodate the new properties, either by proxying them,
     * modifying them, or suppressing them.
     */
    test('Ensure context passed to loader by node has only expected properties', async (t) => {
      const { stdout, stderr } = await exec(
        `node --loader ./esm-loader-context/loader.mjs --experimental-json-modules ./esm-loader-context/index.mjs`
      );
      const rows = stdout.split('\n').filter((v) => v[0] === '{');
      expect(rows.length).toBe(14);
      rows.forEach((row) => {
        const json = JSON.parse(row) as {
          resolveContextKeys?: string[];
          loadContextKeys?: string;
        };
        if (json.resolveContextKeys) {
          expect(json.resolveContextKeys).toEqual([
            'conditions',
            'importAssertions',
            'parentURL',
          ]);
        } else if (json.loadContextKeys) {
          try {
            expect(json.loadContextKeys).toEqual([
              'format',
              'importAssertions',
            ]);
          } catch (e) {
            // HACK for https://github.com/TypeStrong/ts-node/issues/1641
            if (process.version.includes('nightly')) {
              expect(json.loadContextKeys).toEqual([
                'format',
                'importAssertions',
                'parentURL',
              ]);
            } else {
              throw e;
            }
          }
        } else {
          throw new Error('Unexpected stdout in test.');
        }
      });
    });
  });
}
