// copied from https://github.com/nodejs/node/blob/master/lib/internal/modules/cjs/loader.js

module.exports.assertScriptIsNotEsm = assertScriptIsNotEsm;

const packageJsonCache = new Map();

function readPackageScope(checkPath) {
  const rootSeparatorIndex = checkPath.indexOf(path.sep);
  let separatorIndex;
  while (
    (separatorIndex = checkPath.lastIndexOf(path.sep)) > rootSeparatorIndex
  ) {
    checkPath = checkPath.slice(0, separatorIndex);
    if (checkPath.endsWith(path.sep + 'node_modules'))
      return false;
    const pjson = readPackage(checkPath);
    if (pjson) return {
      path: checkPath,
      data: pjson
    };
  }
  return false;
}

function readPackage(requestPath) {
  const jsonPath = path.resolve(requestPath, 'package.json');

  const existing = packageJsonCache.get(jsonPath);
  if (existing !== undefined) return existing;

  const json = internalModuleReadJSON(path.toNamespacedPath(jsonPath));
  if (json === undefined) {
    packageJsonCache.set(jsonPath, false);
    return false;
  }

  if (manifest) {
    const jsonURL = pathToFileURL(jsonPath);
    manifest.assertIntegrity(jsonURL, json);
  }

  try {
    const parsed = JSONParse(json);
    const filtered = {
      name: parsed.name,
      main: parsed.main,
      exports: parsed.exports,
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

// copied from Module._extensions['.js']
function assertScriptIsNotEsm(filename) {
  const pkg = readPackageScope(filename);
  // Function require shouldn't be used in ES modules.
  if (pkg && pkg.data && pkg.data.type === 'module') {
    const parentPath = module.parent && module.parent.filename;
    const packageJsonPath = path.resolve(pkg.path, 'package.json');
    throw createErrRequireEsm(filename, parentPath, packageJsonPath);
  }
}

function createErrRequireEsm(filename, parentPath, packageJsonPath) {
  // Attempt to create an error object that matches node's native error close enough
  const code = 'ERR_REQUIRE_ESM'
  const err = new Error(getMessage(filename, parentPath, packageJsonPath))
  err.name = `Error [${ code }]`
  err.stack
  Object.defineProperty(err, 'name', {
    value: 'Error',
    enumerable: false,
    writable: true,
    configurable: true
  })
  err.code = code
  return err

  // copy-pasted from https://github.com/nodejs/node/blob/master/lib/internal/errors.js#L1294-L1311
  function getMessage(filename, parentPath = null, packageJsonPath = null) {
    const ext = path.extname(filename)
    let msg = `Must use import to load ES Module: ${filename}`;
    if (parentPath && packageJsonPath) {
      const path = require('path');
      const basename = path.basename(filename) === path.basename(parentPath) ?
        filename : path.basename(filename);
      msg +=
        '\nrequire() of ES modules is not supported.\nrequire() of ' +
        `${filename} ${parentPath ? `from ${parentPath} ` : ''}` +
        `is an ES module file as it is a ${ext} file whose nearest parent ` +
        `package.json contains "type": "module" which defines all ${ext} ` +
        'files in that package scope as ES modules.\nInstead ' +
        'change the requiring code to use ' +
        'import(), or remove "type": "module" from ' +
        `${packageJsonPath}.\n`;
      return msg;
    }
    return msg;
  }
}
