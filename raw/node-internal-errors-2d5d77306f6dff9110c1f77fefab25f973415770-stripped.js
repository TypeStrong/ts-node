// Copied from https://github.com/nodejs/node/blob/2d5d77306f6dff9110c1f77fefab25f973415770/lib/internal/errors.js

'use strict';

const codes = {};

function makeNodeErrorWithCode(Base, key) {
  return class NodeError extends Base {
    constructor(...args) {
      if (excludedStackFn === undefined) {
        super();
      } else {
        const limit = Error.stackTraceLimit;
        Error.stackTraceLimit = 0;
        super();
        // Reset the limit and setting the name property.
        Error.stackTraceLimit = limit;
      }
      const message = getMessage(key, args, this);
      ObjectDefineProperty(this, 'message', {
        value: message,
        enumerable: false,
        writable: true,
        configurable: true
      });
      addCodeToName(this, super.name, key);
      this.code = key;
    }

    toString() {
      return `${this.name} [${key}]: ${this.message}`;
    }
  };
}

// Utility function for registering the error codes. Only used here. Exported
// *only* to allow for testing.
function E(sym, val, def, ...otherClasses) {
  // Special case for SystemError that formats the error message differently
  // The SystemErrors only have SystemError as their base classes.
  messages.set(sym, val);
  if (def === SystemError) {
    def = makeSystemErrorWithCode(sym);
  } else {
    def = makeNodeErrorWithCode(def, sym);
  }

  if (otherClasses.length !== 0) {
    otherClasses.forEach((clazz) => {
      def[clazz.name] = makeNodeErrorWithCode(clazz, sym);
    });
  }
  codes[sym] = def;
}

module.exports = {
  addCodeToName, // Exported for NghttpError
  codes,
  dnsException,
  errnoException,
  exceptionWithHostPort,
  getMessage,
  hideStackFrames,
  isStackOverflowError,
  connResetException,
  uvErrmapGet,
  uvException,
  uvExceptionWithHostPort,
  SystemError,
  // This is exported only to facilitate testing.
  E,
  kNoOverride,
  prepareStackTrace,
  maybeOverridePrepareStackTrace,
  overrideStackTrace,
  kEnhanceStackBeforeInspector,
  fatalExceptionStackEnhancers
};

E('ERR_REQUIRE_ESM',
  (filename, parentPath = null, packageJsonPath = null) => {
    let msg = `Must use import to load ES Module: ${filename}`;
    if (parentPath && packageJsonPath) {
      const path = require('path');
      const basename = path.basename(filename) === path.basename(parentPath) ?
        filename : path.basename(filename);
      msg +=
        '\nrequire() of ES modules is not supported.\nrequire() of ' +
        `${filename} ${parentPath ? `from ${parentPath} ` : ''}` +
        'is an ES module file as it is a .js file whose nearest parent ' +
        'package.json contains "type": "module" which defines all .js ' +
        'files in that package scope as ES modules.\nInstead rename ' +
        `${basename} to end in .cjs, change the requiring code to use ` +
        'import(), or remove "type": "module" from ' +
        `${packageJsonPath}.\n`;
      return msg;
    }
    return msg;
  }, Error);
