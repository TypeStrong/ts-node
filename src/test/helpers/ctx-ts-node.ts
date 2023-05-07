import { exec as childProcessExec } from 'child_process';
import { lock } from 'proper-lockfile';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ExecutionContext } from '../testlib';
import { sync as rimrafSync } from 'rimraf';
import { TEST_DIR } from './paths';
import { testsDirRequire, tsNodeTypes } from './misc';

/** Pass to `test.context()` to get access to the ts-node API under test */
export async function ctxTsNode() {
  await installTsNode();
  const tsNodeUnderTest: typeof tsNodeTypes = testsDirRequire('ts-node');
  return {
    tsNodeUnderTest,
  };
}
export namespace ctxTsNode {
  export type Ctx = Awaited<ReturnType<typeof ctxTsNode>>;
  export type T = ExecutionContext<Ctx>;
}

const ts_node_install_lock = process.env.ts_node_install_lock as string;
const lockPath = join(__dirname, ts_node_install_lock);

interface InstallationResult {
  error: string | null;
}

/**
 * Pack and install ts-node locally, necessary to test package "exports"
 * FS locking b/c tests run in separate processes
 */
export async function installTsNode() {
  await lockedMemoizedOperation(lockPath, async () => {
    const totalTries = process.platform === 'win32' ? 5 : 1;
    let tries = 0;
    while (true) {
      try {
        rimrafSync(join(TEST_DIR, '.yarn/cache/ts-node-file-*'));
        writeFileSync(join(TEST_DIR, 'yarn.lock'), '');
        const result = await promisify(childProcessExec)(`yarn --no-immutable`, {
          cwd: TEST_DIR,
        });
        // You can uncomment this to aid debugging
        // console.log(result.stdout, result.stderr);
        rimrafSync(join(TEST_DIR, '.yarn/cache/ts-node-file-*'));
        writeFileSync(join(TEST_DIR, 'yarn.lock'), '');
        break;
      } catch (e) {
        tries++;
        if (tries >= totalTries) throw e;
      }
    }
  });
}

/**
 * Attempt an operation once across multiple processes, using filesystem locking.
 * If it was executed already by another process, and it errored, throw the same error message.
 */
async function lockedMemoizedOperation(lockPath: string, operation: () => Promise<void>) {
  const releaseLock = await lock(lockPath, {
    realpath: false,
    stale: 120e3,
    retries: {
      retries: 120,
      maxTimeout: 1000,
    },
  });
  try {
    const operationHappened = existsSync(lockPath);
    if (operationHappened) {
      const result: InstallationResult = JSON.parse(readFileSync(lockPath, 'utf8'));
      if (result.error) throw result.error;
    } else {
      const result: InstallationResult = { error: null };
      try {
        await operation();
      } catch (e) {
        result.error = `${e}`;
        throw e;
      } finally {
        writeFileSync(lockPath, JSON.stringify(result));
      }
    }
  } finally {
    releaseLock();
  }
}
