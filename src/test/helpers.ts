import { NodeFS } from '@yarnpkg/fslib';
import { exec as childProcessExec } from 'child_process';
import * as promisify from 'util.promisify';
import { sync as rimrafSync } from 'rimraf';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import * as fs from 'fs';
import { Context } from 'ava-shared-setup';
import type { Readable } from 'stream';
import * as assert from 'assert';
/**
 * types from ts-node under test
 */
import type * as tsNodeTypes from '../index';
import type _createRequire from 'create-require';
import { has, mapValues, once, sortBy } from 'lodash';
import semver = require('semver');
import type { ExecutionContext } from './testlib';
const createRequire: typeof _createRequire = require('create-require');
export { tsNodeTypes };

//#region Paths
export const ROOT_DIR = resolve(__dirname, '../..');
export const DIST_DIR = resolve(__dirname, '..');
export const TEST_DIR = join(__dirname, '../../tests');
export const PROJECT = join(TEST_DIR, 'tsconfig.json');
export const PROJECT_TRANSPILE_ONLY = join(
  TEST_DIR,
  'tsconfig-transpile-only.json'
);
export const BIN_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node');
export const BIN_PATH_JS = join(TEST_DIR, 'node_modules/ts-node/dist/bin.js');
export const BIN_SCRIPT_PATH = join(
  TEST_DIR,
  'node_modules/.bin/ts-node-script'
);
export const BIN_CWD_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node-cwd');
export const BIN_ESM_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node-esm');

// process.chdir(TEST_DIR);
assert.strictEqual(process.cwd(), TEST_DIR);
//#endregion

//#region command lines
/** Default `ts-node --project` invocation */
export const CMD_TS_NODE_WITH_PROJECT_FLAG = `"${BIN_PATH}" --project "${PROJECT}"`;
/** Default `ts-node --project` invocation with transpile-only */
export const CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG = `"${BIN_PATH}" --project "${PROJECT_TRANSPILE_ONLY}"`;
/** Default `ts-node` invocation without `--project` */
export const CMD_TS_NODE_WITHOUT_PROJECT_FLAG = `"${BIN_PATH}"`;
export const CMD_ESM_LOADER_WITHOUT_PROJECT = `node --loader ts-node/esm`;
//#endregion

// `createRequire` does not exist on older node versions
export const testsDirRequire = createRequire(join(TEST_DIR, 'index.js'));

export const ts = testsDirRequire('typescript') as typeof import('typescript');

//#region version checks
export const nodeUsesNewHooksApi = semver.gte(process.version, '16.12.0');
// 16.14.0: https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V16.md#notable-changes-4
// 17.1.0: https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V17.md#2021-11-09-version-1710-current-targos
export const nodeSupportsImportAssertions =
  (semver.gte(process.version, '16.14.0') &&
    semver.lt(process.version, '17.0.0')) ||
  semver.gte(process.version, '17.1.0');
// These versions do not require `--experimental-json-modules`
// 16.15.0: https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V16.md#2022-04-26-version-16150-gallium-lts-danielleadams
// 17.5.0: https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V17.md#2022-02-10-version-1750-current-ruyadorno
export const nodeSupportsUnflaggedJsonImports =
  (semver.gte(process.version, '16.15.0') &&
    semver.lt(process.version, '17.0.0')) ||
  semver.gte(process.version, '17.5.0');
// Node 14.13.0 has a bug where it tries to lex CJS files to discover named exports *before*
// we transform the code.
// In other words, it tries to parse raw TS as CJS and balks at `export const foo =`, expecting to see `exports.foo =`
// This lexing only happens when CJS TS is imported from the ESM loader.
export const nodeSupportsImportingTransformedCjsFromEsm = semver.gte(
  process.version,
  '14.13.1'
);
/** Supports module:nodenext and module:node16 as *stable* features */
export const tsSupportsStableNodeNextNode16 =
  ts.version.startsWith('4.7.') || semver.gte(ts.version, '4.7.0');
// TS 4.5 is first version to understand .cts, .mts, .cjs, and .mjs extensions
export const tsSupportsMtsCtsExtensions = semver.gte(ts.version, '4.5.0');
export const tsSupportsImportAssertions = semver.gte(ts.version, '4.5.0');
// TS 4.1 added jsx=react-jsx and react-jsxdev: https://devblogs.microsoft.com/typescript/announcing-typescript-4-1/#react-17-jsx-factories
export const tsSupportsReact17JsxFactories = semver.gte(ts.version, '4.1.0');
// TS 5.0 added "allowImportingTsExtensions"
export const tsSupportsAllowImportingTsExtensions = semver.gte(
  ts.version,
  '4.999.999'
);
// Relevant when @tsconfig/bases refers to es2021 and we run tests against
// old TS versions.
export const tsSupportsEs2021 = semver.gte(ts.version, '4.3.0');
export const tsSupportsEs2022 = semver.gte(ts.version, '4.6.0');
//#endregion

export const xfs = new NodeFS(fs);

/** Pass to `test.context()` to get access to the ts-node API under test */
export const ctxTsNode = once(async () => {
  await installTsNode();
  const tsNodeUnderTest: typeof tsNodeTypes = testsDirRequire('ts-node');
  return {
    tsNodeUnderTest,
  };
});
export namespace ctxTsNode {
  export type Ctx = Awaited<ReturnType<typeof ctxTsNode>>;
  export type T = ExecutionContext<Ctx>;
}

//#region install ts-node tarball

/**
 * Pack and install ts-node locally, necessary to test package "exports"
 * FS locking b/c tests run in separate processes
 */
export async function installTsNode() {
  const context = new Context('installTsNode');
  await context.task('installTsNode', async () => {
    const totalTries = process.platform === 'win32' ? 5 : 1;
    let error;
    for (let tries = 0; tries < totalTries; tries++) {
      try {
        rimrafSync(join(TEST_DIR, '.yarn/cache/ts-node-file-*'));
        await promisify(childProcessExec)(`yarn --no-immutable`, {
          cwd: TEST_DIR,
        });
        // You can uncomment this to aid debugging
        // console.log(result.stdout, result.stderr);
        rimrafSync(join(TEST_DIR, '.yarn/cache/ts-node-file-*'));
        writeFileSync(join(TEST_DIR, 'yarn.lock'), '');
        return;
      } catch (e) {
        error = e;
      }
    }
    throw error;
  });
}
//#endregion

export type GetStream = ReturnType<typeof getStream>;
/**
 * Get a stream into a string.
 * Wait for the stream to end, or wait till some pattern appears in the stream.
 */
export function getStream(stream: Readable) {
  let resolve: (value: string) => void;
  const promise = new Promise<string>((res) => {
    resolve = res;
  });
  const received: Buffer[] = [];
  let combinedBuffer: Buffer = Buffer.concat([]);
  let combinedString: string = '';
  let waitForStart = 0;

  stream.on('data', (data) => {
    received.push(data);
    combine();
  });
  stream.on('end', () => {
    resolve(combinedString);
  });

  return Object.assign(promise, {
    get,
    wait,
    stream,
  });

  function get() {
    return combinedString;
  }

  function wait(pattern: string | RegExp, required = false) {
    return new Promise<string | undefined>((resolve, reject) => {
      const start = waitForStart;
      stream.on('checkWaitFor', checkWaitFor);
      stream.on('end', endOrTimeout);
      checkWaitFor();

      function checkWaitFor() {
        if (typeof pattern === 'string') {
          const index = combinedString.indexOf(pattern, start);
          if (index >= 0) {
            waitForStart = index + pattern.length;
            resolve(combinedString.slice(index, waitForStart));
          }
        } else if (pattern instanceof RegExp) {
          const match = combinedString.slice(start).match(pattern);
          if (match != null) {
            waitForStart = start + match.index!;
            resolve(match[0]);
          }
        }
      }

      function endOrTimeout() {
        required ? reject() : resolve(undefined);
      }
    });
  }

  function combine() {
    combinedBuffer = Buffer.concat(received);
    combinedString = combinedBuffer.toString('utf8');
    stream.emit('checkWaitFor');
  }
}

//#region Reset node environment

const defaultRequireExtensions = captureObjectState(require.extensions);
// Avoid node deprecation warning for accessing _channel
const defaultProcess = captureObjectState(process, ['_channel']);
const defaultModule = captureObjectState(require('module'));
const defaultError = captureObjectState(Error);
const defaultGlobal = captureObjectState(global);

/**
 * Undo all of ts-node & co's installed hooks, resetting the node environment to default
 * so we can run multiple test cases which `.register()` ts-node.
 *
 * Must also play nice with `nyc`'s environmental mutations.
 */
export function resetNodeEnvironment() {
  const sms =
    require('@cspotcode/source-map-support') as typeof import('@cspotcode/source-map-support');
  // We must uninstall so that it resets its internal state; otherwise it won't know it needs to reinstall in the next test.
  sms.uninstall();
  // Must remove handlers to avoid a memory leak
  sms.resetRetrieveHandlers();

  // Modified by ts-node hooks
  resetObject(
    require.extensions,
    defaultRequireExtensions,
    undefined,
    undefined,
    undefined,
    true
  );

  // ts-node attaches a property when it registers an instance
  // source-map-support monkey-patches the emit function
  // Avoid node deprecation warnings for setting process.config or accessing _channel
  resetObject(process, defaultProcess, undefined, ['_channel'], ['config']);

  // source-map-support swaps out the prepareStackTrace function
  resetObject(Error, defaultError);

  // _resolveFilename et.al. are modified by ts-node, tsconfig-paths, source-map-support, yarn, maybe other things?
  resetObject(require('module'), defaultModule, undefined, ['wrap', 'wrapper']);

  // May be modified by REPL tests, since the REPL sets globals.
  // Avoid deleting nyc's coverage data.
  resetObject(global, defaultGlobal, ['__coverage__']);

  // Reset our ESM hooks
  process.__test_setloader__?.(undefined);
}

function captureObjectState(object: any, avoidGetters: string[] = []) {
  const descriptors = Object.getOwnPropertyDescriptors(object);
  const values = mapValues(descriptors, (_d, key) => {
    if (avoidGetters.includes(key)) return descriptors[key].value;
    return object[key];
  });
  return {
    descriptors,
    values,
  };
}
// Redefine all property descriptors and delete any new properties
function resetObject(
  object: any,
  state: ReturnType<typeof captureObjectState>,
  doNotDeleteTheseKeys: string[] = [],
  doNotSetTheseKeys: true | string[] = [],
  avoidSetterIfUnchanged: string[] = [],
  reorderProperties = false
) {
  const currentDescriptors = Object.getOwnPropertyDescriptors(object);
  for (const key of Object.keys(currentDescriptors)) {
    if (doNotDeleteTheseKeys.includes(key)) continue;
    if (has(state.descriptors, key)) continue;
    delete object[key];
  }
  // Trigger nyc's setter functions
  for (const [key, value] of Object.entries(state.values)) {
    try {
      if (doNotSetTheseKeys === true || doNotSetTheseKeys.includes(key))
        continue;
      if (avoidSetterIfUnchanged.includes(key) && object[key] === value)
        continue;
      state.descriptors[key].set?.call(object, value);
    } catch {}
  }
  // Reset descriptors
  Object.defineProperties(object, state.descriptors);

  if (reorderProperties) {
    // Delete and re-define each property so that they are in original order
    const originalOrder = Object.keys(state.descriptors);
    const properties = Object.getOwnPropertyDescriptors(object);
    const sortedKeys = sortBy(Object.keys(properties), (name) =>
      originalOrder.includes(name) ? originalOrder.indexOf(name) : 999
    );
    for (const key of sortedKeys) {
      delete object[key];
      Object.defineProperty(object, key, properties[key]);
    }
  }
}

//#endregion

export const delay = promisify(setTimeout);

/** Essentially Array:includes, but with tweaked types for checks on enums */
export function isOneOf<V>(value: V, arrayOfPossibilities: ReadonlyArray<V>) {
  return arrayOfPossibilities.includes(value as any);
}
