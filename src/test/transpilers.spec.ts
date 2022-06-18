// third-party transpiler and swc transpiler tests
// TODO: at the time of writing, other transpiler tests have not been moved into this file.
// Should consolidate them here.

import { context } from './testlib';
import {
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  ctxTsNode,
  TEST_DIR,
  testsDirRequire,
} from './helpers';
import * as expect from 'expect';
import { createExec } from './exec-helpers';

const exec = createExec({
  cwd: TEST_DIR,
});

const test = context(ctxTsNode);

test.suite('swc', (test) => {
  test('verify that TS->SWC target mappings support all possible values from both TS and SWC', async (t) => {
    const swcTranspiler = testsDirRequire(
      'ts-node/transpilers/swc-experimental'
    ) as typeof import('../transpilers/swc');

    // Detect when mapping is missing any ts.ScriptTargets
    const ts = testsDirRequire('typescript') as typeof import('typescript');
    for (const key of Object.keys(ts.ScriptTarget)) {
      if (/^\d+$/.test(key)) continue;
      if (key === 'JSON') continue;
      expect(
        swcTranspiler.targetMapping.has(ts.ScriptTarget[key as any] as any)
      ).toBe(true);
    }

    // Detect when mapping is missing any swc targets
    // Assuming that tests/package.json declares @swc/core: latest
    const swc = testsDirRequire('@swc/core');
    let msg: string | undefined = undefined;
    try {
      swc.transformSync('', { jsc: { target: 'invalid' } });
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toBeDefined();
    // Error looks like:
    // unknown variant `invalid`, expected one of `es3`, `es5`, `es2015`, `es2016`, `es2017`, `es2018`, `es2019`, `es2020`, `es2021` at line 1 column 28
    const match = msg!.match(/unknown variant.*, expected one of (.*) at line/);
    expect(match).toBeDefined();
    const targets = match![1].split(', ').map((v: string) => v.slice(1, -1));

    for (const target of targets) {
      expect([...swcTranspiler.targetMapping.values()]).toContain(target);
    }
  });

  test('verify paths are mapped correctly', async (t) => {
    const { err, stdout } = await exec(
      `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} swc-with-paths`,
      {
        env: {
          ...process.env,
          NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''}}`,
        },
      }
    );
    expect(err).toBe(null);
    expect(stdout).toMatch('Hello, world!\n');
  });
});
