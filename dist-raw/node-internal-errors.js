'use strict';

const path = require('path');

// TODO will be useful when implementing https://github.com/TypeStrong/ts-node/issues/1754
// Try to pluck this symbol off of an intentionally-created node error
let kIsNodeError;
try {
  path.join(0);
} catch(nodeError) {
  const symbols = Object.getOwnPropertySymbols(nodeError);
  kIsNodeError = symbols.find(s => s.toString().includes('kIsNodeError'));
}

exports.codes = {};

function defineError(code, buildMessage) {
  if (!buildMessage) {
    buildMessage = (...args) => args.join(' ');
  }

  exports.codes[code] = class CustomError extends Error {
    constructor(...args) {
      super(`${code}: ${buildMessage(...args)}`);
      this.code = code;
    }
  }
}

defineError("ERR_INPUT_TYPE_NOT_ALLOWED");
defineError("ERR_INVALID_ARG_VALUE");
defineError("ERR_INVALID_MODULE_SPECIFIER");
defineError("ERR_INVALID_PACKAGE_CONFIG");
defineError("ERR_INVALID_PACKAGE_TARGET");
defineError("ERR_MANIFEST_DEPENDENCY_MISSING");
defineError("ERR_MODULE_NOT_FOUND", (path, base, type = 'package') => {
  return `Cannot find ${type} '${path}' imported from ${base}`;
});
defineError("ERR_PACKAGE_IMPORT_NOT_DEFINED");
defineError("ERR_PACKAGE_PATH_NOT_EXPORTED");
defineError("ERR_UNSUPPORTED_DIR_IMPORT");
defineError("ERR_UNSUPPORTED_ESM_URL_SCHEME");
defineError("ERR_UNKNOWN_FILE_EXTENSION");

exports.createErrRequireEsm = createErrRequireEsm;

// Native ERR_REQUIRE_ESM Error is declared here:
//   https://github.com/nodejs/node/blob/2d5d77306f6dff9110c1f77fefab25f973415770/lib/internal/errors.js#L1294-L1313
// Error class factory is implemented here:
//   function E: https://github.com/nodejs/node/blob/2d5d77306f6dff9110c1f77fefab25f973415770/lib/internal/errors.js#L323-L341
//   function makeNodeErrorWithCode: https://github.com/nodejs/node/blob/2d5d77306f6dff9110c1f77fefab25f973415770/lib/internal/errors.js#L251-L278
// The code below should create an error that matches the native error as closely as possible.
// Third-party libraries which attempt to catch the native ERR_REQUIRE_ESM should recognize our imitation error.
function createErrRequireEsm(filename, parentPath, packageJsonPath) {
  const code = 'ERR_REQUIRE_ESM'
  const err = new Error(getErrRequireEsmMessage(filename, parentPath, packageJsonPath))
  // Set `name` to be used in stack trace, generate stack trace with that name baked in, then re-declare the `name` field.
  // This trick is copied from node's source.
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
}

// Copy-pasted from https://github.com/nodejs/node/blob/b533fb3508009e5f567cc776daba8fbf665386a6/lib/internal/errors.js#L1293-L1311
// so that our error message is identical to the native message.
function getErrRequireEsmMessage(filename, parentPath = null, packageJsonPath = null) {
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
