// Copied from several files in node's source code.
// https://github.com/nodejs/node/blob/2d5d77306f6dff9110c1f77fefab25f973415770/lib/internal/modules/cjs/loader.js
// Each function and variable below must have a comment linking to the source in node's github repo.

const {
  JSONParse,
  SafeMap,
  StringPrototypeEndsWith,
  StringPrototypeLastIndexOf,
  StringPrototypeIndexOf,
  StringPrototypeSlice,
} = require('./node-primordials');
const path = require('path');
const { sep } = path;
const packageJsonReader = require('./node-internal-modules-package_json_reader');
const {normalizeSlashes} = require('../dist/util');
const {createErrRequireEsm} = require('./node-internal-errors');



// Copied from https://github.com/nodejs/node/blob/2d5d77306f6dff9110c1f77fefab25f973415770/lib/internal/modules/cjs/loader.js#L249
const packageJsonCache = new SafeMap();

// Copied from https://github.com/nodejs/node/blob/v15.3.0/lib/internal/modules/cjs/loader.js#L275-L304
function readPackage(requestPath) {
  const jsonPath = path.resolve(requestPath, 'package.json');

  const existing = packageJsonCache.get(jsonPath);
  if (existing !== undefined) return existing;

  const result = packageJsonReader.read(jsonPath);
  const json = result.containsKeys === false ? '{}' : result.string;
  if (json === undefined) {
    packageJsonCache.set(jsonPath, false);
    return false;
  }

  try {
    const parsed = JSONParse(json);
    const filtered = {
      name: parsed.name,
      main: parsed.main,
      exports: parsed.exports,
      imports: parsed.imports,
      type: parsed.type
    };
    packageJsonCache.set(jsonPath, filtered);
    return filtered;
  } catch (e) {
    e.path = jsonPath;
    e.message = 'Error parsing ' + jsonPath + ': ' + e.message;
    throw e;
  }
}

// Copied from https://github.com/nodejs/node/blob/2d5d77306f6dff9110c1f77fefab25f973415770/lib/internal/modules/cjs/loader.js#L285-L301
function readPackageScope(checkPath) {
  const rootSeparatorIndex = StringPrototypeIndexOf(checkPath, sep);
  let separatorIndex;
  while (
    (separatorIndex = StringPrototypeLastIndexOf(checkPath, sep)) > rootSeparatorIndex
  ) {
    checkPath = StringPrototypeSlice(checkPath, 0, separatorIndex);
    if (StringPrototypeEndsWith(checkPath, sep + 'node_modules'))
      return false;
    const pjson = readPackage(checkPath);
    if (pjson) return {
      path: checkPath,
      data: pjson
    };
  }
  return false;
}

/**
 * copied from Module._extensions['.js']
 * https://github.com/nodejs/node/blob/v15.3.0/lib/internal/modules/cjs/loader.js#L1113-L1120
 * @param {import('../src/index').Service} service
 * @param {NodeJS.Module} module
 * @param {string} filename
 */
function assertScriptCanLoadAsCJSImpl(service, module, filename) {
  const pkg = readPackageScope(filename);

  // ts-node modification: allow our configuration to override
  const tsNodeClassification = service.moduleTypeClassifier.classifyModule(normalizeSlashes(filename));
  if(tsNodeClassification.moduleType === 'cjs') return;

  // Function require shouldn't be used in ES modules.
  if (tsNodeClassification.moduleType === 'esm' || (pkg && pkg.data && pkg.data.type === 'module')) {
    const parentPath = module.parent && module.parent.filename;
    const packageJsonPath = pkg ? path.resolve(pkg.path, 'package.json') : null;
    throw createErrRequireEsm(filename, parentPath, packageJsonPath);
  }
}

module.exports = {
  assertScriptCanLoadAsCJSImpl
};
