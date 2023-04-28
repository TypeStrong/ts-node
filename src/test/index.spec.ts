import { context, ExecutionContext } from './testlib';
import * as expect from 'expect';
import { join, resolve, sep as pathSep } from 'path';
import semver = require('semver');
import { project as fsProject } from '@TypeStrong/fs-fixture-builder';
import {
  BIN_PATH_JS,
  CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG,
  ctxTmpDirOutsideCheckout,
  ts,
  tsSupportsEs2021,
  tsSupportsEs2022,
  tsSupportsMtsCtsExtensions,
  tsSupportsStableNodeNextNode16,
} from './helpers';
import { lstatSync } from 'fs';
import { createExec } from './exec-helpers';
import {
  BIN_CWD_PATH,
  BIN_PATH,
  BIN_SCRIPT_PATH,
  DIST_DIR,
  ROOT_DIR,
  TEST_DIR,
  testsDirRequire,
  ctxTsNode,
  CMD_TS_NODE_WITH_PROJECT_FLAG,
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  CMD_ESM_LOADER_WITHOUT_PROJECT,
} from './helpers';
import type { CreateOptions } from '..';

const exec = createExec({
  cwd: TEST_DIR,
});

const test = context(ctxTsNode);

test.suite('ts-node', (test) => {
  test('should export the correct version', (t) => {
    expect(t.context.tsNodeUnderTest.VERSION).toBe(
      require('../../package.json').version
    );
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

  test('should not load typescript outside of loadConfig', async () => {
    const r = await exec(
      `node -e "require('ts-node'); console.dir(Object.keys(require.cache).filter(k => k.includes('node_modules/typescript')).length)"`
    );
    expect(r.err).toBe(null);
    expect(r.stdout).toBe('0\n');
  });

  test.suite('cli', (test) => {
    test('should execute cli', async () => {
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} hello-world`);
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, world!\n');
    });

    test('shows usage via --help', async () => {
      const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} --help`);
      expect(r.err).toBe(null);
      expect(r.stdout).toMatch(/Usage: ts-node /);
    });
    test('shows version via -v', async () => {
      const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} -v`);
      expect(r.err).toBe(null);
      expect(r.stdout.trim()).toBe(
        'v' + testsDirRequire('ts-node/package').version
      );
    });
    test('shows version of compiler via -vv', async () => {
      const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} -vv`);
      expect(r.err).toBe(null);
      expect(r.stdout.trim()).toBe(
        `ts-node v${testsDirRequire('ts-node/package').version}\n` +
          `node ${process.version}\n` +
          `compiler v${testsDirRequire('typescript/package').version}`
      );
    });

    test('should register via cli', async () => {
      const r = await exec(`node -r ts-node/register hello-world.ts`, {
        cwd: TEST_DIR,
      });
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, world!\n');
    });

    test('should execute cli with absolute path', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} "${join(
          TEST_DIR,
          'hello-world'
        )}"`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, world!\n');
    });

    test('should print scripts', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_FLAG} -pe "import { example } from './complex/index';example()"`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('example\n');
    });

    test("should expose ts-node Service as a symbol property on Node's `process` object", async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} env`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('object\n');
    });

    test('should allow js', async () => {
      const r = await exec(
        [
          CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG,
          '-O "{\\"allowJs\\":true}"',
          '-pe "import { main } from \'./allow-js/run\';main()"',
        ].join(' ')
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('hello world\n');
    });

    test('should include jsx when `allow-js` true', async () => {
      const r = await exec(
        [
          CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG,
          '-O "{\\"allowJs\\":true}"',
          '-pe "import { Foo2 } from \'./allow-js/with-jsx\'; Foo2.sayHi()"',
        ].join(' ')
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('hello world\n');
    });

    test.suite('should support cts when module = CommonJS', (test) => {
      test.if(tsSupportsMtsCtsExtensions);
      test('test', async (t) => {
        const r = await exec(
          [
            CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
            '-pe "import { main } from \'./index.cjs\';main()"',
          ].join(' '),
          {
            cwd: join(TEST_DIR, 'ts45-ext/ext-cts'),
          }
        );
        expect(r.err).toBe(null);
        expect(r.stdout).toBe('hello world\n');
      });
    });

    test.suite('should support mts when module = ESNext', (test) => {
      test.if(tsSupportsMtsCtsExtensions);
      test('test', async () => {
        const r = await exec(
          [CMD_TS_NODE_WITHOUT_PROJECT_FLAG, './entrypoint.mjs'].join(' '),
          {
            cwd: join(TEST_DIR, 'ts45-ext/ext-mts'),
          }
        );
        expect(r.err).toBe(null);
        expect(r.stdout).toBe('hello world\n');
      });
    });

    test('should eval code', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} -e "import * as m from './module';console.log(m.example('test'))"`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('TEST\n');
    });

    test('should import empty files', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} -e "import './empty'"`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('');
    });

    test('should throw typechecking errors', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_FLAG} -e "import * as m from './module';console.log(m.example(123))"`
      );
      if (r.err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(r.err.message).toMatch(
        new RegExp(
          "TS2345: Argument of type '(?:number|123)' " +
            "is not assignable to parameter of type 'string'\\."
        )
      );
    });

    test('should be able to ignore diagnostic', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_FLAG} --ignore-diagnostics 2345 -e "import * as m from './module';console.log(m.example(123))"`
      );
      if (r.err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(r.err.message).toMatch(
        /TypeError: (?:(?:undefined|foo\.toUpperCase) is not a function|.*has no method \'toUpperCase\')/
      );
    });

    test('should work with source maps', async () => {
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} "throw error"`);
      if (r.err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(r.err.message).toMatch(
        [
          `${join(TEST_DIR, 'throw error.ts')}:100`,
          "  bar() { throw new Error('this is a demo'); }",
          '                ^',
          'Error: this is a demo',
        ].join('\n')
      );
    });

    test('should work with source maps in --transpile-only mode', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_FLAG} --transpile-only "throw error"`
      );
      if (r.err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(r.err.message).toMatch(
        [
          `${join(TEST_DIR, 'throw error.ts')}:100`,
          "  bar() { throw new Error('this is a demo'); }",
          '                ^',
          'Error: this is a demo',
        ].join('\n')
      );
    });

    test('eval should work with source maps', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_FLAG} -pe "import './throw error'"`
      );
      if (r.err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(r.err.message).toMatch(
        [
          `${join(TEST_DIR, 'throw error.ts')}:100`,
          "  bar() { throw new Error('this is a demo'); }",
          '                ^',
        ].join('\n')
      );
    });

    for (const flavor of [
      '--transpiler ts-node/transpilers/swc transpile-only-swc',
      '--transpiler ts-node/transpilers/swc-experimental transpile-only-swc',
      '--swc transpile-only-swc',
      'transpile-only-swc-via-tsconfig',
      'transpile-only-swc-shorthand-via-tsconfig',
    ]) {
      test(`should support swc and third-party transpilers: ${flavor}`, async () => {
        const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} ${flavor}`, {
          env: {
            ...process.env,
            NODE_OPTIONS: `${
              process.env.NODE_OPTIONS || ''
            } --require ${require.resolve('../../tests/spy-swc-transpiler')}`,
          },
        });
        expect(r.err).toBe(null);
        expect(r.stdout).toMatch(
          'Hello World! swc transpiler invocation count: 1\n'
        );
      });
    }

    test.suite('should support `traceResolution` compiler option', (test) => {
      test('prints traces before running code when enabled', async () => {
        const r = await exec(
          `${BIN_PATH} --compiler-options="{ \\"traceResolution\\": true }" -e "console.log('ok')"`
        );
        expect(r.err).toBeNull();
        expect(r.stdout).toContain('======== Resolving module');
        expect(r.stdout.endsWith('ok\n')).toBe(true);
      });

      test('does NOT print traces when not enabled', async () => {
        const r = await exec(`${BIN_PATH} -e "console.log('ok')"`);
        expect(r.err).toBeNull();
        expect(r.stdout).not.toContain('======== Resolving module');
        expect(r.stdout.endsWith('ok\n')).toBe(true);
      });
    });

    test('swc transpiler supports native ESM emit', async () => {
      const r = await exec(`${CMD_ESM_LOADER_WITHOUT_PROJECT} ./index.ts`, {
        cwd: resolve(TEST_DIR, 'transpile-only-swc-native-esm'),
      });
      expect(r.err).toBe(null);
      expect(r.stdout).toMatch('Hello file://');
    });

    test('should pipe into `ts-node` and evaluate', async () => {
      const p = exec(CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG);
      p.child.stdin!.end("console.log('hello')");
      const r = await p;
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('hello\n');
    });

    test('should pipe into `ts-node`', async () => {
      const p = exec(`${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} -p`);
      p.child.stdin!.end('true');
      const r = await p;
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('true\n');
    });

    test('should pipe into an eval script', async () => {
      const p = exec(
        `${CMD_TS_NODE_WITH_PROJECT_FLAG} --transpile-only -pe "process.stdin.isTTY"`
      );
      p.child.stdin!.end('true');
      const r = await p;
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('undefined\n');
    });

    test('should support require flags', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} -r ./hello-world -pe "console.log('success')"`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, world!\nsuccess\nundefined\n');
    });

    test('should support require from node modules', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} -r typescript -e "console.log('success')"`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('success\n');
    });

    test('should use source maps with react tsx', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_FLAG} "throw error react tsx.tsx"`
      );
      expect(r.err).not.toBe(null);
      expect(r.err!.message).toMatch(
        [
          `${join(TEST_DIR, './throw error react tsx.tsx')}:100`,
          "  bar() { throw new Error('this is a demo'); }",
          '                ^',
          'Error: this is a demo',
        ].join('\n')
      );
    });

    test('should use source maps with react tsx in --transpile-only mode', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_FLAG} --transpile-only "throw error react tsx.tsx"`
      );
      expect(r.err).not.toBe(null);
      expect(r.err!.message).toMatch(
        [
          `${join(TEST_DIR, './throw error react tsx.tsx')}:100`,
          "  bar() { throw new Error('this is a demo'); }",
          '                ^',
          'Error: this is a demo',
        ].join('\n')
      );
    });

    test('should allow custom typings', async () => {
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} custom-types`);
      // This error comes from *node*, meaning TypeScript respected the custom types (good) but *node* could not find the non-existent module (expected)
      expect(r.err?.message).toMatch(
        /Error: Cannot find module 'does-not-exist'/
      );
    });

    test('should import js before ts by default', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} import-order/compiled`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, JavaScript!\n');
    });

    test('should import ts before js when --prefer-ts-exts flag is present', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} --prefer-ts-exts import-order/compiled`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, TypeScript!\n');
    });

    test('should import ts before js when TS_NODE_PREFER_TS_EXTS env is present', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} import-order/compiled`,
        {
          env: { ...process.env, TS_NODE_PREFER_TS_EXTS: 'true' },
        }
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, TypeScript!\n');
    });

    test('should ignore .d.ts files', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} import-order/importer`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, World!\n');
    });

    test.suite('issue #884', (test) => {
      test('should compile', async (t) => {
        const r = await exec(
          `"${BIN_PATH}" --project issue-884/tsconfig.json issue-884`
        );
        expect(r.err).toBe(null);
        expect(r.stdout).toBe('');
      });
    });

    test.suite('issue #986', (test) => {
      test('should not compile', async () => {
        const r = await exec(
          `"${BIN_PATH}" --project issue-986/tsconfig.json issue-986`
        );
        expect(r.err).not.toBe(null);
        expect(r.stderr).toMatch("Cannot find name 'TEST'"); // TypeScript error.
        expect(r.stdout).toBe('');
      });

      test('should compile with `--files`', async () => {
        const r = await exec(
          `"${BIN_PATH}" --files --project issue-986/tsconfig.json issue-986`
        );
        expect(r.err).not.toBe(null);
        expect(r.stderr).toMatch('ReferenceError: TEST is not defined'); // Runtime error.
        expect(r.stdout).toBe('');
      });
    });

    test('should locate tsconfig relative to entry-point by default', async () => {
      const r = await exec(`${BIN_PATH} ../a/index`, {
        cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
      });
      expect(r.err).toBe(null);
      expect(r.stdout).toMatch(/plugin-a/);
    });
    test('should locate tsconfig relative to entry-point via ts-node-script', async () => {
      const r = await exec(`${BIN_SCRIPT_PATH} ../a/index`, {
        cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
      });
      expect(r.err).toBe(null);
      expect(r.stdout).toMatch(/plugin-a/);
    });
    test('should locate tsconfig relative to entry-point with --script-mode', async () => {
      const r = await exec(`${BIN_PATH} --script-mode ../a/index`, {
        cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
      });
      expect(r.err).toBe(null);
      expect(r.stdout).toMatch(/plugin-a/);
    });
    test('should locate tsconfig relative to cwd via ts-node-cwd', async () => {
      const r = await exec(`${BIN_CWD_PATH} ../a/index`, {
        cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
      });
      expect(r.err).toBe(null);
      expect(r.stdout).toMatch(/plugin-b/);
    });
    test('should locate tsconfig relative to cwd in --cwd-mode', async () => {
      const r = await exec(`${BIN_PATH} --cwd-mode ../a/index`, {
        cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
      });
      expect(r.err).toBe(null);
      expect(r.stdout).toMatch(/plugin-b/);
    });
    test('should locate tsconfig relative to realpath, not symlink, when entrypoint is a symlink', async (t) => {
      if (
        lstatSync(
          join(TEST_DIR, 'main-realpath/symlink/symlink.tsx')
        ).isSymbolicLink()
      ) {
        const r = await exec(`${BIN_PATH} main-realpath/symlink/symlink.tsx`);
        expect(r.err).toBe(null);
        expect(r.stdout).toBe('');
      } else {
        t.log('Skipping');
        return;
      }
    });

    test('should have the correct working directory in the user entry-point', async () => {
      const r = await exec(`${BIN_PATH} --cwd ./cjs index.ts`, {
        cwd: resolve(TEST_DIR, 'working-dir'),
      });

      expect(r.err).toBe(null);
      expect(r.stdout.trim()).toBe('Passing');
      expect(r.stderr).toBe('');
    });

    // Disabled due to bug:
    // --cwd is passed to forked children when not using --esm, erroneously affects their entrypoint resolution.
    // tracked/fixed by either https://github.com/TypeStrong/ts-node/issues/1834
    // or https://github.com/TypeStrong/ts-node/issues/1831
    test.skip('should be able to fork into a nested TypeScript script with a modified working directory', async () => {
      const r = await exec(`${BIN_PATH} --cwd ./working-dir/forking/ index.ts`);

      expect(r.err).toBe(null);
      expect(r.stdout.trim()).toBe('Passing: from main');
      expect(r.stderr).toBe('');
    });

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
        test('implicitly uses @tsconfig/node14, @tsconfig/node16, @tsconfig/node18, or @tsconfig/node20 compilerOptions when both TS and node versions support it', async (t) => {
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
        test(`ts-node/node20/tsconfig.json`, macro, 'node20');
      }
    );

    test.suite('compiler host', (test) => {
      test('should execute cli', async () => {
        const r = await exec(
          `${CMD_TS_NODE_WITH_PROJECT_FLAG} --compiler-host hello-world`
        );
        expect(r.err).toBe(null);
        expect(r.stdout).toBe('Hello, world!\n');
      });
    });

    test('should transpile files inside a node_modules directory when not ignored', async () => {
      const r = await exec(
        `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} from-node-modules/from-node-modules`
      );
      if (r.err)
        throw new Error(
          `Unexpected error: ${r.err}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`
        );
      expect(JSON.parse(r.stdout)).toEqual({
        external: {
          tsmri: { name: 'typescript-module-required-internally' },
          jsmri: { name: 'javascript-module-required-internally' },
          tsmii: { name: 'typescript-module-imported-internally' },
          jsmii: { name: 'javascript-module-imported-internally' },
        },
        tsmie: { name: 'typescript-module-imported-externally' },
        jsmie: { name: 'javascript-module-imported-externally' },
        tsmre: { name: 'typescript-module-required-externally' },
        jsmre: { name: 'javascript-module-required-externally' },
      });
    });

    test.suite('should respect maxNodeModulesJsDepth', (test) => {
      test('for unscoped modules', async () => {
        const r = await exec(
          `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} maxnodemodulesjsdepth`
        );
        expect(r.err).not.toBe(null);
        expect(r.stderr.replace(/\r\n/g, '\n')).toMatch(
          'TSError: ⨯ Unable to compile TypeScript:\n' +
            "maxnodemodulesjsdepth/other.ts(4,7): error TS2322: Type 'string' is not assignable to type 'boolean'.\n" +
            '\n'
        );
      });

      test('for @scoped modules', async () => {
        const r = await exec(
          `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} maxnodemodulesjsdepth-scoped`
        );
        expect(r.err).not.toBe(null);
        expect(r.stderr.replace(/\r\n/g, '\n')).toMatch(
          'TSError: ⨯ Unable to compile TypeScript:\n' +
            "maxnodemodulesjsdepth-scoped/other.ts(7,7): error TS2322: Type 'string' is not assignable to type 'boolean'.\n" +
            '\n'
        );
      });
    });

    test('--showConfig should log resolved configuration', async (t) => {
      function native(path: string) {
        return path.replace(/\/|\\/g, pathSep);
      }
      function posix(path: string) {
        return path.replace(/\/|\\/g, '/');
      }
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} --showConfig`);
      expect(r.err).toBe(null);
      t.is(
        r.stdout,
        JSON.stringify(
          {
            'ts-node': {
              cwd: native(`${ROOT_DIR}/tests`),
              projectSearchDir: native(`${ROOT_DIR}/tests`),
              project: native(`${ROOT_DIR}/tests/tsconfig.json`),
            },
            compilerOptions: {
              target: 'es6',
              jsx: 'react',
              noEmit: false,
              strict: true,
              typeRoots: [
                posix(`${ROOT_DIR}/tests/typings`),
                posix(`${ROOT_DIR}/node_modules/@types`),
              ],
              sourceMap: true,
              inlineSourceMap: false,
              inlineSources: true,
              declaration: false,
              outDir: './.ts-node',
              module: 'commonjs',
            },
          },
          null,
          2
        ) + '\n'
      );
    });

    test('should support compiler scope specified via tsconfig.json', async (t) => {
      const r = await exec(
        `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} --project ./scope/c/config/tsconfig.json ./scope/c/index.js`
      );
      expect(r.err).toBe(null);
      expect(r.stdout).toBe(`value\nFailures: 0\n`);
    });
  });

  test.suite('create', ({ contextEach }) => {
    const test = contextEach(async (t) => {
      return {
        service: t.context.tsNodeUnderTest.create({
          compilerOptions: { target: 'es5' },
          skipProject: true,
        }),
      };
    });

    test('should create generic compiler instances', (t) => {
      const output = t.context.service.compile('const x = 10', 'test.ts');
      expect(output).toMatch('var x = 10;');
    });

    test.suite('should get type information', (test) => {
      test('given position of identifier', (t) => {
        expect(
          t.context.service.getTypeInfo(
            '/**jsdoc here*/const x = 10',
            'test.ts',
            21
          )
        ).toEqual({
          comment: 'jsdoc here',
          name: 'const x: 10',
        });
      });
      test('given position that does not point to an identifier', (t) => {
        expect(
          t.context.service.getTypeInfo(
            '/**jsdoc here*/const x = 10',
            'test.ts',
            0
          )
        ).toEqual({
          comment: '',
          name: '',
        });
      });
    });
  });

  test.suite('issue #1098', (test) => {
    function testAllowedExtensions(
      t: ExecutionContext<ctxTsNode.Ctx>,
      compilerOptions: CreateOptions['compilerOptions'],
      allowed: string[]
    ) {
      const disallowed = allExtensions.filter((ext) => !allowed.includes(ext));
      const { ignored } = t.context.tsNodeUnderTest.create({
        compilerOptions,
        skipProject: true,
      });
      for (const ext of allowed) {
        t.log(`Testing that ${ext} files are allowed`);
        expect(ignored(join(DIST_DIR, `index${ext}`))).toBe(false);
      }
      for (const ext of disallowed) {
        t.log(`Testing that ${ext} files are ignored`);
        expect(ignored(join(DIST_DIR, `index${ext}`))).toBe(true);
      }
    }

    const allExtensions = [
      '.ts',
      '.js',
      '.d.ts',
      '.mts',
      '.cts',
      '.d.mts',
      '.d.cts',
      '.mjs',
      '.cjs',
      '.tsx',
      '.jsx',
      '.xyz',
      '',
    ];
    const mtsCts = tsSupportsMtsCtsExtensions
      ? ['.mts', '.cts', '.d.mts', '.d.cts']
      : [];
    const mjsCjs = tsSupportsMtsCtsExtensions ? ['.mjs', '.cjs'] : [];

    test('correctly filters file extensions from the compiler when allowJs=false and jsx=false', (t) => {
      testAllowedExtensions(t, {}, ['.ts', '.d.ts', ...mtsCts]);
    });
    test('correctly filters file extensions from the compiler when allowJs=true and jsx=false', (t) => {
      testAllowedExtensions(t, { allowJs: true }, [
        '.ts',
        '.js',
        '.d.ts',
        ...mtsCts,
        ...mjsCjs,
      ]);
    });
    test('correctly filters file extensions from the compiler when allowJs=false and jsx=true', (t) => {
      testAllowedExtensions(t, { allowJs: false, jsx: 'preserve' }, [
        '.ts',
        '.tsx',
        '.d.ts',
        ...mtsCts,
      ]);
    });
    test('correctly filters file extensions from the compiler when allowJs=true and jsx=true', (t) => {
      testAllowedExtensions(t, { allowJs: true, jsx: 'preserve' }, [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.d.ts',
        ...mtsCts,
        ...mjsCjs,
      ]);
    });
  });
});

test('Falls back to transpileOnly when ts compiler returns emitSkipped', async () => {
  const r = await exec(
    `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} --project tsconfig.json ./outside-rootDir/foo.js`,
    {
      cwd: join(TEST_DIR, 'emit-skipped-fallback'),
    }
  );
  expect(r.err).toBe(null);
  expect(r.stdout).toBe('foo\n');
});

test.suite('node environment', (test) => {
  test.suite('Sets argv and execArgv correctly in forked processes', (test) => {
    forkTest(`node --no-warnings ${BIN_PATH_JS}`, BIN_PATH_JS, '--no-warnings');
    forkTest(
      `${BIN_PATH}`,
      process.platform === 'win32' ? BIN_PATH_JS : BIN_PATH
    );

    function forkTest(
      command: string,
      expectParentArgv0: string,
      nodeFlag?: string
    ) {
      test(command, async (t) => {
        const r = await exec(
          `${command} --skipIgnore ./recursive-fork/index.ts argv2`
        );
        expect(r.err).toBeNull();
        expect(r.stderr).toBe('');
        const generations = r.stdout.split('\n');
        const expectation = {
          execArgv: [nodeFlag, BIN_PATH_JS, '--skipIgnore'].filter((v) => v),
          argv: [
            // Note: argv[0] is *always* BIN_PATH_JS in child & grandchild
            expectParentArgv0,
            resolve(TEST_DIR, 'recursive-fork/index.ts'),
            'argv2',
          ],
        };
        expect(JSON.parse(generations[0])).toMatchObject(expectation);
        expectation.argv[0] = BIN_PATH_JS;
        expect(JSON.parse(generations[1])).toMatchObject(expectation);
        expect(JSON.parse(generations[2])).toMatchObject(expectation);
      });
    }
  });
});

test('Detect when typescript adds new ModuleKind values; flag as a failure so we can update our code flagged [MUST_UPDATE_FOR_NEW_MODULEKIND]', async () => {
  // We have marked a few places in our code with MUST_UPDATE_FOR_NEW_MODULEKIND to make it easier to update them when TS adds new ModuleKinds
  const foundKeys: string[] = [];
  function check(value: number, name: string, required: boolean) {
    if (required) expect(ts.ModuleKind[name as any]).toBe(value);
    if (ts.ModuleKind[value] === undefined) {
      expect(ts.ModuleKind[name as any]).toBeUndefined();
    } else {
      expect(ts.ModuleKind[value]).toBe(name);
      foundKeys.push(name, `${value}`);
    }
  }
  check(0, 'None', true);
  check(1, 'CommonJS', true);
  check(2, 'AMD', true);
  check(3, 'UMD', true);
  check(4, 'System', true);
  check(5, 'ES2015', true);
  try {
    check(6, 'ES2020', false);
    check(99, 'ESNext', true);
  } catch {
    // the value changed: is `99` now, but was `6` in TS 2.7
    check(6, 'ESNext', true);
    expect(ts.ModuleKind[99]).toBeUndefined();
  }
  check(7, 'ES2022', false);
  if (tsSupportsStableNodeNextNode16) {
    check(100, 'Node16', true);
  } else {
    check(100, 'Node12', false);
  }
  check(199, 'NodeNext', false);
  const actualKeys = Object.keys(ts.ModuleKind);
  actualKeys.sort();
  foundKeys.sort();
  expect(actualKeys).toEqual(foundKeys);
});
