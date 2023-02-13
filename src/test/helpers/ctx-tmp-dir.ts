import { tmpdir } from 'os';
import type { ExecutionContext } from '../testlib';
import { tempdirProject } from '@TypeStrong/fs-fixture-builder';

/**
 * This helpers gives you an empty directory in the OS temp directory, *outside*
 * of the git clone.
 *
 * Some tests must run in a directory that is *outside* of the git clone.
 * When TS and ts-node search for a tsconfig, they traverse up the filesystem.
 * If they run inside our git clone, they will find the root tsconfig.json, and
 * we do not always want that.
 */
export async function ctxTmpDirOutsideCheckout(t: ExecutionContext) {
  const fixture = tempdirProject({
    name: 'ts-node-spec',
    rootDir: tmpdir(),
  });
  return {
    tmpDir: fixture.cwd,
    fixture,
  };
}
export namespace ctxTmpDirOutsideCheckout {
  export type Ctx = Awaited<ReturnType<typeof ctxTmpDirOutsideCheckout>>;
  export type T = ExecutionContext<Ctx>;
}

export async function ctxTmpDir(t: ExecutionContext) {
  const fixture = tempdirProject('ts-node-spec');
  return {
    fixture,
    tmpDir: fixture.cwd,
  };
}
export namespace ctxTmpDir {
  export type Ctx = Awaited<ReturnType<typeof ctxTmpDirOutsideCheckout>>;
  export type T = ExecutionContext<Ctx>;
}
