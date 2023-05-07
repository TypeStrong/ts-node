import { has, mapValues, sortBy } from 'lodash';

// Reset node environment
// Useful because ts-node installation necessarily must mutate the node environment.
// Yet we want to run tests in-process for speed.
// So we need to reliably reset everything changed by ts-node installation.

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
  const sms = require('@cspotcode/source-map-support') as typeof import('@cspotcode/source-map-support');
  // We must uninstall so that it resets its internal state; otherwise it won't know it needs to reinstall in the next test.
  sms.uninstall();
  // Must remove handlers to avoid a memory leak
  sms.resetRetrieveHandlers();

  // Modified by ts-node hooks
  resetObject(require.extensions, defaultRequireExtensions, undefined, undefined, undefined, true);

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
      if (doNotSetTheseKeys === true || doNotSetTheseKeys.includes(key)) continue;
      if (avoidSetterIfUnchanged.includes(key) && object[key] === value) continue;
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
