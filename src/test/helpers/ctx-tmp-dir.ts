import { mkdtempSync } from 'fs';
import { join } from 'path';
import type { ExecutionContext } from '../testlib';
import { TEST_DIR } from './paths';

export async function ctxTmpDir(t: ExecutionContext) {
  return {
    tmpDir: mkdtempSync(join(TEST_DIR, 'tmp/ts-node-spec')),
  };
}
export namespace ctxTmpDir {
  export type Ctx = Awaited<ReturnType<typeof ctxTmpDir>>;
  export type T = ExecutionContext<Ctx>;
}
