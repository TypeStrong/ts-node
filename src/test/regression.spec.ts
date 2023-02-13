// Misc regression tests go here if they do not have a better home

import * as exp from 'expect';
import { join } from 'path';
import { createExec, createExecTester } from './exec-helpers';
import {
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  ctxTsNode,
  TEST_DIR,
} from './helpers';
import { context } from './testlib';

const test = context(ctxTsNode);
const exec = createExecTester({
  exec: createExec({
    cwd: TEST_DIR,
  }),
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
