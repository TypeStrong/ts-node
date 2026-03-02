// Misc regression tests go here if they do not have a better home

import * as exp from 'expect';
import { join } from 'path';
import type { CreateOptions } from '..';
import { createExec, createExecTester } from './helpers/exec';
import { CMD_TS_NODE_WITHOUT_PROJECT_FLAG, ctxTsNode, DIST_DIR, TEST_DIR, tsSupportsMtsCtsExtensions } from './helpers';
import { context, ExecutionContext, expect } from './testlib';

const test = context(ctxTsNode);
const exec = createExecTester({
  exec: createExec({
    cwd: TEST_DIR,
  }),
});

test('#2076 regression test', async () => {
  const r = await exec({
    exec: createExec({
      cwd: join(TEST_DIR, '2076'),
    }),
    cmd: `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} --showConfig`,
  });

  exp(r.err).toBeNull();
});

test('#1488 regression test', async () => {
  // Scenario that caused the bug:
  // `allowJs` turned on
  // `skipIgnore` turned on so that ts-node tries to compile itself (not ideal but theoretically we should be ok with this)
  // Attempt to `require()` a `.js` file
  // `assertScriptCanLoadAsCJS` is triggered within `require()`
  // `./package.json` needs to be fetched into cache via `assertScriptCanLoadAsCJS` which caused a recursive `require()` call
  // Circular dependency warning is emitted by node

  const r = await exec({
    exec: createExec({
      cwd: join(TEST_DIR, '1488'),
    }),
    cmd: `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} ./index.js`,
  });

  exp(r.err).toBeNull();

  // Assert that we do *not* get `Warning: Accessing non-existent property 'getOptionValue' of module exports inside circular dependency`
  exp(r.stdout).toBe('foo\n'); // prove that it ran
  exp(r.stderr).toBe(''); // prove that no warnings
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
  const mtsCts = tsSupportsMtsCtsExtensions ? ['.mts', '.cts', '.d.mts', '.d.cts'] : [];
  const mjsCjs = tsSupportsMtsCtsExtensions ? ['.mjs', '.cjs'] : [];

  test('correctly filters file extensions from the compiler when allowJs=false and jsx=false', (t) => {
    testAllowedExtensions(t, {}, ['.ts', '.d.ts', ...mtsCts]);
  });
  test('correctly filters file extensions from the compiler when allowJs=true and jsx=false', (t) => {
    testAllowedExtensions(t, { allowJs: true }, ['.ts', '.js', '.d.ts', ...mtsCts, ...mjsCjs]);
  });
  test('correctly filters file extensions from the compiler when allowJs=false and jsx=true', (t) => {
    testAllowedExtensions(t, { allowJs: false, jsx: 'preserve' }, ['.ts', '.tsx', '.d.ts', ...mtsCts]);
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
