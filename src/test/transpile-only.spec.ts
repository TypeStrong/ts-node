import { createExec } from './helpers/exec';
import { ctxTsNode, tsSupportsVerbatimModuleSyntax } from './helpers';
import { CMD_TS_NODE_WITH_PROJECT_FLAG } from './helpers/command-lines';
import { TEST_DIR } from './helpers/paths';
import { expect, context } from './testlib';

const test = context(ctxTsNode);

const exec = createExec({
  cwd: TEST_DIR,
});

test('should support transpile only mode', async () => {
  const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} --transpile-only -pe "x"`);
  if (r.err === null) {
    throw new Error('Command was expected to fail, but it succeeded.');
  }

  expect(r.err.message).toMatch('ReferenceError: x is not defined');
});

test('should throw error even in transpileOnly mode', async () => {
  const r = await exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} --transpile-only -pe "console."`);
  if (r.err === null) {
    throw new Error('Command was expected to fail, but it succeeded.');
  }

  expect(r.err.message).toMatch('error TS1003: Identifier expected');
});

test.suite('verbatimModuleSyntax w/transpileOnly should not raise configuration diagnostic', (test) => {
  test.if(tsSupportsVerbatimModuleSyntax);
  test('test', async (t) => {
    // Mixing verbatimModuleSyntax w/transpileOnly
    // https://github.com/TypeStrong/ts-node/issues/1971
    // We should *not* get:
    // "error TS5104: Option 'isolatedModules' is redundant and cannot be specified with option 'verbatimModuleSyntax'."
    const service = t.context.tsNodeUnderTest.create({
      transpileOnly: true,
      compilerOptions: { verbatimModuleSyntax: true },
    });
    service.compile('const foo: string = 123', 'module.ts');
  });
});
