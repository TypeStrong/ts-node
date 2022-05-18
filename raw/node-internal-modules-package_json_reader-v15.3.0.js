// Copied from https://github.com/nodejs/node/blob/v15.3.0/lib/internal/modules/package_json_reader.js

'use strict';

const { SafeMap } = primordials;
const { internalModuleReadJSON } = internalBinding('fs');
const { pathToFileURL } = require('url');
const { toNamespacedPath } = require('path');

const cache = new SafeMap();

let manifest;

/**
 *
 * @param {string} jsonPath
 */
function read(jsonPath) {
  if (cache.has(jsonPath)) {
    return cache.get(jsonPath);
  }

  const [string, containsKeys] = internalModuleReadJSON(
    toNamespacedPath(jsonPath)
  );
  const result = { string, containsKeys };
  const { getOptionValue } = require('internal/options');
  if (string !== undefined) {
    if (manifest === undefined) {
      manifest = getOptionValue('--experimental-policy') ?
        require('internal/process/policy').manifest :
        null;
    }
    if (manifest !== null) {
      const jsonURL = pathToFileURL(jsonPath);
      manifest.assertIntegrity(jsonURL, string);
    }
  }
  cache.set(jsonPath, result);
  return result;
}

module.exports = { read };
