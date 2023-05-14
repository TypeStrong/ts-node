import { createExec } from '../helpers/exec';
import { ctxTsNode, TEST_DIR, tsSupportsStableNodeNextNode16, CMD_TS_NODE_WITHOUT_PROJECT_FLAG } from '../helpers';
import { context, expect } from '../testlib';
import { join } from 'path';

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
