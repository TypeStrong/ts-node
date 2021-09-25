import {
  ChildProcess,
  exec as childProcessExec,
  ExecException,
  ExecOptions,
} from 'child_process';
import * as promisify from 'util.promisify';
import { sync as rimrafSync } from 'rimraf';
import {
  existsSync,
  fstat,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  unlinkSync,
  writeFile,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { lock, lockSync } from 'proper-lockfile';
import type * as tsNodeTypes from '../index';
import type _createRequire from 'create-require';
const createRequire: typeof _createRequire = require('create-require');

export const ROOT_DIR = resolve(__dirname, '../..');
export const DIST_DIR = resolve(__dirname, '..');
export const TEST_DIR = join(__dirname, '../../tests');
export const PROJECT = join(TEST_DIR, 'tsconfig.json');
export const BIN_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node');
export const BIN_SCRIPT_PATH = join(
  TEST_DIR,
  'node_modules/.bin/ts-node-script'
);
export const BIN_CWD_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node-cwd');

// `createRequire` does not exist on older node versions
export const testsDirRequire = createRequire(join(TEST_DIR, 'index.js'));

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
        rimrafSync(join(TEST_DIR, 'node_modules'));
        await promisify(childProcessExec)(`npm install`, { cwd: TEST_DIR });
        const packageLockPath = join(TEST_DIR, 'package-lock.json');
        existsSync(packageLockPath) && unlinkSync(packageLockPath);
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
async function lockedMemoizedOperation(
  lockPath: string,
  operation: () => Promise<void>
) {
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
      const result: InstallationResult = JSON.parse(
        readFileSync(lockPath, 'utf8')
      );
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
