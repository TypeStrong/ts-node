import { context } from './testlib';
import * as expect from 'expect';
import { createExec } from './exec-helpers';
import {
  TEST_DIR,
  ctxTsNode,
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
} from './helpers';

const exec = createExec({
  cwd: TEST_DIR,
});

const test = context(ctxTsNode);

test('Supports .ts extensions in import specifiers with typechecking, even though vanilla TS checker does not', async () => {
  const { err, stdout } = await exec(
    `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} ts-import-specifiers/index.ts`
  );
  expect(err).toBe(null);
  expect(stdout.trim()).toBe('{ foo: true, bar: true }');
});
