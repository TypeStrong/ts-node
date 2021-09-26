import { NodeFS } from '@yarnpkg/fslib';
import { exec as childProcessExec } from 'child_process';
import * as promisify from 'util.promisify';
import { sync as rimrafSync } from 'rimraf';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import * as fs from 'fs';
import { lock } from 'proper-lockfile';
import type { Readable } from 'stream';
/**
 * types from ts-node under test
 */
import type * as tsNodeTypes from '../index';
import type _createRequire from 'create-require';
import { once } from 'lodash';
import semver = require('semver');
import { isConstructSignatureDeclaration } from 'typescript';
const createRequire: typeof _createRequire = require('create-require');
export { tsNodeTypes };

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
/** Default `ts-node --project` invocation */
export const CMD_TS_NODE_WITH_PROJECT_FLAG = `"${BIN_PATH}" --project "${PROJECT}"`;
/** Default `ts-node` invocation without `--project` */
export const CMD_TS_NODE_WITHOUT_PROJECT_FLAG = `"${BIN_PATH}"`;
export const EXPERIMENTAL_MODULES_FLAG = semver.gte(process.version, '12.17.0')
  ? ''
  : '--experimental-modules';
export const CMD_ESM_LOADER_WITHOUT_PROJECT = `node ${EXPERIMENTAL_MODULES_FLAG} --loader ts-node/esm`;

// `createRequire` does not exist on older node versions
export const testsDirRequire = createRequire(join(TEST_DIR, 'index.js'));

export const xfs = new NodeFS(fs);

/** Pass to `test.context()` to get access to the ts-node API under test */
export const contextTsNodeUnderTest = once(async () => {
  await installTsNode();
  const tsNodeUnderTest = testsDirRequire('ts-node');
  return {
    tsNodeUnderTest,
  };
});

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

/**
 * Get a stream into a string.
 * Will resolve early if
 */
export function getStream(stream: Readable, waitForPattern?: string | RegExp) {
  let resolve: (value: string) => void;
  const promise = new Promise<string>((res) => {
    resolve = res;
  });
  const received: Buffer[] = [];
  let combinedBuffer: Buffer = Buffer.concat([]);
  let combinedString: string = '';

  stream.on('data', (data) => {
    received.push(data);
    combine();
    if (
      (typeof waitForPattern === 'string' &&
        combinedString.indexOf(waitForPattern) >= 0) ||
      (waitForPattern instanceof RegExp && combinedString.match(waitForPattern))
    )
      resolve(combinedString);
    combinedBuffer = Buffer.concat(received);
  });
  stream.on('end', () => {
    resolve(combinedString);
  });

  return promise;

  function combine() {
    combinedBuffer = Buffer.concat(received);
    combinedString = combinedBuffer.toString('utf8');
  }
}
