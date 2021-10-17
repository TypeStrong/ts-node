// copied from https://github.com/nodejs/node/blob/v15.3.0/lib/internal/modules/package_json_reader.js
'use strict';

const { SafeMap } = require('./node-primordials');
const { pathToFileURL } = require('url');
const { toNamespacedPath } = require('path');
// const { getOptionValue } = require('./node-options');

/** @param {ReturnType<typeof import('./node-internal-fs').createNodeInternalModuleReadJSON>} internalModuleReadJSON */
function createNodePackageJsonReader(internalModuleReadJSON) {
// Intentionally un-indented to keep diff small without needing to mess with whitespace-ignoring flags
const cache = new SafeMap();

let manifest;

/**
 * @param {string} jsonPath
 * @return {[string, boolean]}
 */
function read(jsonPath) {
  if (cache.has(jsonPath)) {
    return cache.get(jsonPath);
  }

  const [string, containsKeys] = internalModuleReadJSON(
    toNamespacedPath(jsonPath)
  );
  const result = { string, containsKeys };
  if (string !== undefined) {
    if (manifest === undefined) {
      // manifest = getOptionValue('--experimental-policy') ?
      //   require('internal/process/policy').manifest :
      //   null;
      // disabled for now.  I am not sure if/how we should support this
      manifest = null;
    }
    if (manifest !== null) {
      const jsonURL = pathToFileURL(jsonPath);
      manifest.assertIntegrity(jsonURL, string);
    }
  }
  cache.set(jsonPath, result);
  return result;
}

return { read };
}

module.exports.createNodePackageJsonReader = createNodePackageJsonReader;
