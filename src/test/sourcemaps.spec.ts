import * as expect from 'expect';
import { createExec, createExecTester, CMD_TS_NODE_WITH_PROJECT_FLAG, ctxTsNode, TEST_DIR } from './helpers';
import { context } from './testlib';
const test = context(ctxTsNode);

const exec = createExecTester({
  cmd: CMD_TS_NODE_WITH_PROJECT_FLAG,
  exec: createExec({
    cwd: TEST_DIR,
  }),
});

test('Redirects source-map-support to @cspotcode/source-map-support so that third-party libraries get correct source-mapped locations', async () => {
  const r = await exec({
    flags: `./legacy-source-map-support-interop/index.ts`,
  });
  expect(r.err).toBeNull();
  expect(r.stdout.split('\n')).toMatchObject([
    expect.stringContaining('.ts:2 '),
    'true',
    'true',
    expect.stringContaining('.ts:100:'),
    expect.stringContaining('.ts:101 '),
    '',
  ]);
});
