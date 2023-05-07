import { join } from 'path';
import { createExec } from './exec-helpers';
import { ctxTmpDirOutsideCheckout } from './helpers/ctx-tmp-dir';
import { ctxTsNode } from './helpers/ctx-ts-node';
import { BIN_PATH, TEST_DIR } from './helpers/paths';
import { tsSupportsEs2021, tsSupportsEs2022 } from './helpers/version-checks';
import { context, ExecutionContext, expect } from './testlib';
import semver = require('semver');

const exec = createExec({
  cwd: TEST_DIR,
});

const test = context(ctxTsNode);

test.suite(
  'should use implicit @tsconfig/bases config when one is not loaded from disk',
  ({ contextEach }) => {
    const test = contextEach(ctxTmpDirOutsideCheckout);
    const libAndTarget =
      semver.gte(process.versions.node, '18.0.0') && tsSupportsEs2022
        ? 'es2022'
        : semver.gte(process.versions.node, '16.0.0') && tsSupportsEs2021
        ? 'es2021'
        : 'es2020';
    test('implicitly uses @tsconfig/node14, @tsconfig/node16, or @tsconfig/node18 compilerOptions when both TS and node versions support it', async (t) => {
      const r1 = await exec(`${BIN_PATH} --showConfig`, {
        cwd: t.context.tmpDir,
      });
      expect(r1.err).toBe(null);
      t.like(JSON.parse(r1.stdout), {
        compilerOptions: {
          target: libAndTarget,
          lib: [libAndTarget],
        },
      });
      const r2 = await exec(`${BIN_PATH} -pe 10n`, {
        cwd: t.context.tmpDir,
      });
      expect(r2.err).toBe(null);
      expect(r2.stdout).toBe('10n\n');
    });
    test('implicitly loads @types/node even when not installed within local directory', async (t) => {
      const r = await exec(`${BIN_PATH} -pe process.env.foo`, {
        cwd: t.context.tmpDir,
        env: { ...process.env, foo: 'hello world' },
      });
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('hello world\n');
    });
    test('implicitly loads local @types/node', async (t) => {
      t.context.fixture.readFrom(
        join(TEST_DIR, 'local-types-node'),
        undefined,
        []
      );
      t.context.fixture.write();
      const r = await exec(`${BIN_PATH} -pe process.env.foo`, {
        cwd: t.context.fixture.cwd,
        env: { ...process.env, foo: 'hello world' },
      });
      expect(r.err).not.toBe(null);
      expect(r.stderr).toMatch(
        "Property 'env' does not exist on type 'LocalNodeTypes_Process'"
      );
    });
  }
);

test.suite(
  'should bundle @tsconfig/bases to be used in your own tsconfigs',
  (test) => {
    // Older TS versions will complain about newer `target` and `lib` options
    test.if(tsSupportsEs2022);
    const macro = test.macro((nodeVersion: string) => async (t) => {
      const config = require(`@tsconfig/${nodeVersion}/tsconfig.json`);
      const r = await exec(`${BIN_PATH} --showConfig -e 10n`, {
        cwd: join(TEST_DIR, 'tsconfig-bases', nodeVersion),
      });
      expect(r.err).toBe(null);
      t.like(JSON.parse(r.stdout), {
        compilerOptions: {
          target: config.compilerOptions.target,
          lib: config.compilerOptions.lib,
        },
      });
    });
    test(`ts-node/node14/tsconfig.json`, macro, 'node14');
    test(`ts-node/node16/tsconfig.json`, macro, 'node16');
    test(`ts-node/node18/tsconfig.json`, macro, 'node18');
  }
);
