import * as expect from 'expect';
import { createExec, createExecTester } from './exec-helpers';
import {
  CMD_TS_NODE_WITH_PROJECT_FLAG,
  contextTsNodeUnderTest,
  HACK_EXPECT_UPGRADE,
  TEST_DIR,
} from './helpers';
import { test as _test } from './testlib';
const test = _test.context(contextTsNodeUnderTest);

const exec = createExecTester({
  cmd: CMD_TS_NODE_WITH_PROJECT_FLAG,
  exec: createExec({
    cwd: TEST_DIR,
  }),
});

test('Redirects source-map-support to @cspotcode/source-map-support so that third-party libraries get correct source-mapped locations', async () => {
  const { stdout } = await exec({
    flags: `./legacy-source-map-support-interop/index.ts`,
  });
  expect(stdout.split('\n')).toMatchObject([
    expect.stringContaining('.ts:2 '),
    'true',
    'true',
    expect.stringContaining('.ts:100:'),
    expect.stringContaining('.ts:101 '),
    '',
  ] as HACK_EXPECT_UPGRADE);
});
