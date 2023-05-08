import { context } from './testlib';
import * as expect from 'expect';
import { join, resolve, sep as pathSep } from 'path';
import {
  BIN_PATH_JS,
  CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG,
  tsSupportsMtsCtsExtensions,
  BIN_PATH,
  ROOT_DIR,
  TEST_DIR,
  testsDirRequire,
  ctxTsNode,
  CMD_TS_NODE_WITH_PROJECT_FLAG,
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  CMD_ESM_LOADER_WITHOUT_PROJECT,
  createExec,
} from './helpers';

const exec = createExec({
  cwd: TEST_DIR,
});

const test = context(ctxTsNode);

test.suite('ts-node', (test) => {
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
      expect(r.stdout.trim()).toBe('v' + testsDirRequire('ts-node/package').version);
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
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} "${join(TEST_DIR, 'hello-world')}"`);
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
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} env`);
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
          [CMD_TS_NODE_WITHOUT_PROJECT_FLAG, '-pe "import { main } from \'./index.cjs\';main()"'].join(' '),
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
        const r = await exec([CMD_TS_NODE_WITHOUT_PROJECT_FLAG, './entrypoint.mjs'].join(' '), {
          cwd: join(TEST_DIR, 'ts45-ext/ext-mts'),
        });
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
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} -e "import './empty'"`);
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
        new RegExp("TS2345: Argument of type '(?:number|123)' " + "is not assignable to parameter of type 'string'\\.")
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
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} --transpile-only "throw error"`);
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
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} -pe "import './throw error'"`);
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
            NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require ${require.resolve(
              '../../tests/spy-swc-transpiler'
            )}`,
          },
        });
        expect(r.err).toBe(null);
        expect(r.stdout).toMatch('Hello World! swc transpiler invocation count: 1\n');
      });
    }

    test.suite('should support `traceResolution` compiler option', (test) => {
      test('prints traces before running code when enabled', async () => {
        const r = await exec(`${BIN_PATH} --compiler-options="{ \\"traceResolution\\": true }" -e "console.log('ok')"`);
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
      const p = exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} --transpile-only -pe "process.stdin.isTTY"`);
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
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} -r typescript -e "console.log('success')"`);
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('success\n');
    });

    test('should use source maps with react tsx', async () => {
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} "throw error react tsx.tsx"`);
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
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} --transpile-only "throw error react tsx.tsx"`);
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
      expect(r.err?.message).toMatch(/Error: Cannot find module 'does-not-exist'/);
    });

    test('should import js before ts by default', async () => {
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} import-order/compiled`);
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, JavaScript!\n');
    });

    test('should import ts before js when --prefer-ts-exts flag is present', async () => {
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} --prefer-ts-exts import-order/compiled`);
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, TypeScript!\n');
    });

    test('should import ts before js when TS_NODE_PREFER_TS_EXTS env is present', async () => {
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} import-order/compiled`, {
        env: { ...process.env, TS_NODE_PREFER_TS_EXTS: 'true' },
      });
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, TypeScript!\n');
    });

    test('should ignore .d.ts files', async () => {
      const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG} import-order/importer`);
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('Hello, World!\n');
    });

    test.suite('issue #884', (test) => {
      test('should compile', async (t) => {
        const r = await exec(`"${BIN_PATH}" --project issue-884/tsconfig.json issue-884`);
        expect(r.err).toBe(null);
        expect(r.stdout).toBe('');
      });
    });

    test.suite('issue #986', (test) => {
      test('should not compile', async () => {
        const r = await exec(`"${BIN_PATH}" --project issue-986/tsconfig.json issue-986`);
        expect(r.err).not.toBe(null);
        expect(r.stderr).toMatch("Cannot find name 'TEST'"); // TypeScript error.
        expect(r.stdout).toBe('');
      });

      test('should compile with `--files`', async () => {
        const r = await exec(`"${BIN_PATH}" --files --project issue-986/tsconfig.json issue-986`);
        expect(r.err).not.toBe(null);
        expect(r.stderr).toMatch('ReferenceError: TEST is not defined'); // Runtime error.
        expect(r.stdout).toBe('');
      });
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

    test.suite('compiler host', (test) => {
      test('should execute cli', async () => {
        const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} --compiler-host hello-world`);
        expect(r.err).toBe(null);
        expect(r.stdout).toBe('Hello, world!\n');
      });
    });

    test('should transpile files inside a node_modules directory when not ignored', async () => {
      const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} from-node-modules/from-node-modules`);
      if (r.err) throw new Error(`Unexpected error: ${r.err}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
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
        const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} maxnodemodulesjsdepth`);
        expect(r.err).not.toBe(null);
        expect(r.stderr.replace(/\r\n/g, '\n')).toMatch(
          'TSError: ⨯ Unable to compile TypeScript:\n' +
            "maxnodemodulesjsdepth/other.ts(4,7): error TS2322: Type 'string' is not assignable to type 'boolean'.\n" +
            '\n'
        );
      });

      test('for @scoped modules', async () => {
        const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} maxnodemodulesjsdepth-scoped`);
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
              typeRoots: [posix(`${ROOT_DIR}/tests/typings`), posix(`${ROOT_DIR}/node_modules/@types`)],
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
});

test('Falls back to transpileOnly when ts compiler returns emitSkipped', async () => {
  const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} --project tsconfig.json ./outside-rootDir/foo.js`, {
    cwd: join(TEST_DIR, 'emit-skipped-fallback'),
  });
  expect(r.err).toBe(null);
  expect(r.stdout).toBe('foo\n');
});

test.suite('node environment', (test) => {
  test.suite('Sets argv and execArgv correctly in forked processes', (test) => {
    forkTest(`node --no-warnings ${BIN_PATH_JS}`, BIN_PATH_JS, '--no-warnings');
    forkTest(`${BIN_PATH}`, process.platform === 'win32' ? BIN_PATH_JS : BIN_PATH);

    function forkTest(command: string, expectParentArgv0: string, nodeFlag?: string) {
      test(command, async (t) => {
        const r = await exec(`${command} --skipIgnore ./recursive-fork/index.ts argv2`);
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
