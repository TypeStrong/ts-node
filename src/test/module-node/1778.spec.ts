import { join } from 'path';

import { createExec } from '../exec-helpers';
import {
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  TEST_DIR,
  ctxTsNode,
  tsSupportsStableNodeNextNode16,
} from '../helpers';
import { context, expect } from '../testlib';

const exec = createExec({
  cwd: TEST_DIR,
});

const test = context(ctxTsNode);

test.suite(
  'Issue #1778: typechecker resolver should take importer\'s module type -- cjs or esm -- into account when resolving package.json "exports"',
  (test) => {
    test.if(tsSupportsStableNodeNextNode16);
    test('test', async () => {
      const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} ./index.ts`, {
        cwd: join(TEST_DIR, '1778'),
      });
      expect(r.err).toBe(null);
      expect(r.stdout).toBe('{ esm: true }\n');
    });
  }
);
