import { BIN_PATH } from '../helpers/paths';
import { createExec } from '../helpers/exec';
import { TEST_DIR } from '../helpers/paths';
import { context, expect } from '../testlib';
import { join, resolve } from 'path';
import { tsSupportsExtendsArray } from '../helpers/version-checks';
import { ctxTsNode } from '../helpers/ctx-ts-node';

const test = context(ctxTsNode);

const exec = createExec({
  cwd: TEST_DIR,
});

test.suite('should read ts-node options from tsconfig.json', (test) => {
  const BIN_EXEC = `"${BIN_PATH}" --project tsconfig-options/tsconfig.json`;

  test('should override compiler options from env', async () => {
    const r = await exec(`${BIN_EXEC} tsconfig-options/log-options1.js`, {
      env: {
        ...process.env,
        TS_NODE_COMPILER_OPTIONS: '{"typeRoots": ["env-typeroots"]}',
      },
    });
    expect(r.err).toBe(null);
    const { config } = JSON.parse(r.stdout);
    expect(config.options.typeRoots).toEqual([join(TEST_DIR, './tsconfig-options/env-typeroots').replace(/\\/g, '/')]);
  });

  test('should use options from `tsconfig.json`', async () => {
    const r = await exec(`${BIN_EXEC} tsconfig-options/log-options1.js`);
    expect(r.err).toBe(null);
    const { options, config } = JSON.parse(r.stdout);
    expect(config.options.typeRoots).toEqual([
      join(TEST_DIR, './tsconfig-options/tsconfig-typeroots').replace(/\\/g, '/'),
    ]);
    expect(config.options.types).toEqual(['tsconfig-tsnode-types']);
    expect(options.pretty).toBe(undefined);
    expect(options.skipIgnore).toBe(false);
    expect(options.transpileOnly).toBe(true);
    expect(options.require).toEqual([join(TEST_DIR, './tsconfig-options/required1.js')]);
  });

  test('should ignore empty strings in the array options', async () => {
    const r = await exec(`${BIN_EXEC} tsconfig-options/log-options1.js`, {
      env: {
        ...process.env,
        TS_NODE_IGNORE: '',
      },
    });
    expect(r.err).toBe(null);
    const { options } = JSON.parse(r.stdout);
    expect(options.ignore).toEqual([]);
  });

  test('should have flags override / merge with `tsconfig.json`', async () => {
    const r = await exec(
      `${BIN_EXEC} --skip-ignore --compiler-options "{\\"types\\":[\\"flags-types\\"]}" --require ./tsconfig-options/required2.js tsconfig-options/log-options2.js`
    );
    expect(r.err).toBe(null);
    const { options, config } = JSON.parse(r.stdout);
    expect(config.options.typeRoots).toEqual([
      join(TEST_DIR, './tsconfig-options/tsconfig-typeroots').replace(/\\/g, '/'),
    ]);
    expect(config.options.types).toEqual(['flags-types']);
    expect(options.pretty).toBe(undefined);
    expect(options.skipIgnore).toBe(true);
    expect(options.transpileOnly).toBe(true);
    expect(options.require).toEqual([
      join(TEST_DIR, './tsconfig-options/required1.js'),
      './tsconfig-options/required2.js',
    ]);
  });

  test('should have `tsconfig.json` override environment', async () => {
    const r = await exec(`${BIN_EXEC} tsconfig-options/log-options1.js`, {
      env: {
        ...process.env,
        TS_NODE_PRETTY: 'true',
        TS_NODE_SKIP_IGNORE: 'true',
      },
    });
    expect(r.err).toBe(null);
    const { options, config } = JSON.parse(r.stdout);
    expect(config.options.typeRoots).toEqual([
      join(TEST_DIR, './tsconfig-options/tsconfig-typeroots').replace(/\\/g, '/'),
    ]);
    expect(config.options.types).toEqual(['tsconfig-tsnode-types']);
    expect(options.pretty).toBe(true);
    expect(options.skipIgnore).toBe(false);
    expect(options.transpileOnly).toBe(true);
    expect(options.require).toEqual([join(TEST_DIR, './tsconfig-options/required1.js')]);
  });

  test('should pull ts-node options from extended `tsconfig.json`', async () => {
    const r = await exec(`${BIN_PATH} --show-config --project ./tsconfig-extends/tsconfig.json`);
    expect(r.err).toBe(null);
    const config = JSON.parse(r.stdout);
    expect(config['ts-node'].require).toEqual([resolve(TEST_DIR, 'tsconfig-extends/other/require-hook.js')]);
    expect(config['ts-node'].scopeDir).toBe(resolve(TEST_DIR, 'tsconfig-extends/other/scopedir'));
    expect(config['ts-node'].preferTsExts).toBe(true);
  });

  test.suite('should pull ts-node options from extended `tsconfig.json`', (test) => {
    test.if(tsSupportsExtendsArray);
    test('test', async () => {
      const r = await exec(`${BIN_PATH} --show-config --project ./tsconfig-extends-multiple/tsconfig.json`);
      expect(r.err).toBe(null);
      const config = JSON.parse(r.stdout);

      // root tsconfig extends [a, c]
      // a extends b
      // c extends d

      // https://devblogs.microsoft.com/typescript/announcing-typescript-5-0-beta/#supporting-multiple-configuration-files-in-extends
      // If any fields "conflict", the latter entry wins.

      // This value comes from c
      expect(config.compilerOptions.target).toBe('es2017');

      // From root
      expect(config['ts-node'].preferTsExts).toBe(true);

      // From a
      expect(config['ts-node'].require).toEqual([
        resolve(TEST_DIR, 'tsconfig-extends-multiple/a/require-hook-from-a.js'),
      ]);

      // From a, overrides declaration in b
      expect(config['ts-node'].scopeDir).toBe(resolve(TEST_DIR, 'tsconfig-extends-multiple/a/scopedir-from-a'));

      // From b
      const key = process.platform === 'win32' ? 'b\\module-types-from-b' : 'b/module-types-from-b';
      expect(config['ts-node'].moduleTypes).toStrictEqual({
        [key]: 'cjs',
      });

      // From c, overrides declaration in b
      expect(config['ts-node'].transpiler).toBe('transpiler-from-c');

      // From d, inherited by c, overrides value from b
      expect(config['ts-node'].ignore).toStrictEqual(['ignore-pattern-from-d']);
    });
  });
});
