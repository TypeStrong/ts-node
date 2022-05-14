// Copied from several files in node's source code.
// https://github.com/nodejs/node/blob/2d5d77306f6dff9110c1f77fefab25f973415770/lib/internal/modules/cjs/loader.js
// Each function and variable below must have a comment linking to the source in node's github repo.

'use strict';

const {
  JSONParse,
  SafeMap,
  StringPrototypeEndsWith,
  StringPrototypeLastIndexOf,
  StringPrototypeIndexOf,
  StringPrototypeSlice,
  ArrayPrototypeJoin,
  StringPrototypeCharCodeAt,
  RegExpPrototypeTest,
  ObjectKeys,
  StringPrototypeMatch,
} = require('./node-primordials');
const { pathToFileURL, fileURLToPath } = require('url');
const fs = require('fs');
const path = require('path');
const { sep } = path;
const { internalModuleStat } = require('./node-internal-fs');
const packageJsonReader = require('./node-internal-modules-package_json_reader');
const {
  cjsConditions,
} = require('./node-internal-modules-cjs-helpers');
const { getOptionValue } = require('./node-options');
const preserveSymlinks = getOptionValue('--preserve-symlinks');
const preserveSymlinksMain = getOptionValue('--preserve-symlinks-main');
const {normalizeSlashes} = require('../dist/util');
const {createErrRequireEsm} = require('./node-internal-errors');
const {
  codes: {
    ERR_INVALID_MODULE_SPECIFIER,
  },
} = require('./node-internal-errors');

const {
  CHAR_FORWARD_SLASH,
} = require('./node-internal-constants');

const Module = require('module');

let statCache = null;

function stat(filename) {
  filename = path.toNamespacedPath(filename);
  if (statCache !== null) {
    const result = statCache.get(filename);
    if (result !== undefined) return result;
  }
  const result = internalModuleStat(filename);
  if (statCache !== null && result >= 0) {
    // Only set cache when `internalModuleStat(filename)` succeeds.
    statCache.set(filename, result);
  }
  return result;
}


// Given a module name, and a list of paths to test, returns the first
// matching file in the following precedence.
//
// require("a.<ext>")
//   -> a.<ext>
//
// require("a")
//   -> a
//   -> a.<ext>
//   -> a/index.<ext>

const packageJsonCache = new SafeMap();

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

function readPackageScope(checkPath) {
  const rootSeparatorIndex = StringPrototypeIndexOf(checkPath, sep);
  let separatorIndex;
  do {
    separatorIndex = StringPrototypeLastIndexOf(checkPath, sep);
    checkPath = StringPrototypeSlice(checkPath, 0, separatorIndex);
    if (StringPrototypeEndsWith(checkPath, sep + 'node_modules'))
      return false;
    const pjson = readPackage(checkPath + sep);
    if (pjson) return {
      data: pjson,
      path: checkPath,
    };
  } while (separatorIndex > rootSeparatorIndex);
  return false;
}

/**
 * @param {{
 *   nodeEsmResolver: ReturnType<typeof import('./node-internal-modules-esm-resolve').createResolve>,
 *   compiledExtensions: string[],
 *   preferTsExts
 * }} opts
 */
function createCjsLoader(opts) {
  // TODO don't need this if we get it from Object.keys(module.extensions) always?
  const {nodeEsmResolver, compiledExtensions, preferTsExts} = opts;
const {
  encodedSepRegEx,
  packageExportsResolve,
  // packageImportsResolve
} = nodeEsmResolver;

function tryPackage(requestPath, exts, isMain, originalPath) {
  // const pkg = readPackage(requestPath)?.main;
  const tmp = readPackage(requestPath)
  const pkg = tmp != null ? tmp.main : undefined;

  if (!pkg) {
    return tryExtensions(path.resolve(requestPath, 'index'), exts, isMain);
  }

  const filename = path.resolve(requestPath, pkg);
  let actual = tryReplacementExtensions(filename, isMain) ||
    tryFile(filename, isMain) ||
    tryExtensions(filename, exts, isMain) ||
    tryExtensions(path.resolve(filename, 'index'), exts, isMain);
  if (actual === false) {
    actual = tryExtensions(path.resolve(requestPath, 'index'), exts, isMain);
    if (!actual) {
      // eslint-disable-next-line no-restricted-syntax
      const err = new Error(
        `Cannot find module '${filename}'. ` +
        'Please verify that the package.json has a valid "main" entry'
      );
      err.code = 'MODULE_NOT_FOUND';
      err.path = path.resolve(requestPath, 'package.json');
      err.requestPath = originalPath;
      // TODO(BridgeAR): Add the requireStack as well.
      throw err;
    } else {
      const jsonPath = path.resolve(requestPath, 'package.json');
      process.emitWarning(
        `Invalid 'main' field in '${jsonPath}' of '${pkg}'. ` +
          'Please either fix that or report it to the module author',
        'DeprecationWarning',
        'DEP0128'
      );
    }
  }
  return actual;
}

// In order to minimize unnecessary lstat() calls,
// this cache is a list of known-real paths.
// Set to an empty Map to reset.
const realpathCache = new SafeMap();

// Check if the file exists and is not a directory
// if using --preserve-symlinks and isMain is false,
// keep symlinks intact, otherwise resolve to the
// absolute realpath.
function tryFile(requestPath, isMain) {
  const rc = stat(requestPath);
  if (rc !== 0) return;
  if (preserveSymlinks && !isMain) {
    return path.resolve(requestPath);
  }
  return toRealPath(requestPath);
}

function toRealPath(requestPath) {
  return fs.realpathSync(requestPath, {
    // [internalFS.realpathCacheKey]: realpathCache
  });
}

/**
 * TS's resolver can resolve foo.js to foo.ts, by replacing .js extension with several source extensions.
 * IMPORTANT: preserve ordering according to preferTsExts; this affects resolution behavior!
 */
const extensions = Array.from(new Set([
  ...(preferTsExts ? compiledExtensions : []),
  '.js', '.json', '.node', '.mjs', '.cjs',
  ...compiledExtensions
]));
const replacementExtensions = {
  '.js': extensions.filter(ext => ['.js', '.jsx', '.ts', '.tsx'].includes(ext)),
  '.cjs': extensions.filter(ext => ['.cjs', '.cts'].includes(ext)),
  '.mjs': extensions.filter(ext => ['.mjs', '.mts'].includes(ext)),
};

const replacableExtensionRe = /(\.(?:js|cjs|mjs))$/;

function statReplacementExtensions(p) {
  const match = p.match(replacableExtensionRe);
  if (match) {
    const replacementExts = replacementExtensions[match[1]];
    const pathnameWithoutExtension = p.slice(0, -match[1].length);
    for (let i = 0; i < replacementExts.length; i++) {
      const filename = pathnameWithoutExtension + replacementExts[i];
      const rc = stat(filename);
      if (rc === 0) {
        return [rc, filename];
      }
    }
  }
  return [stat(p), p];
}
function tryReplacementExtensions(p, isMain) {
  const match = p.match(replacableExtensionRe);
  if (match) {
    const replacementExts = replacementExtensions[match[1]];
    const pathnameWithoutExtension = p.slice(0, -match[1].length);
    for (let i = 0; i < replacementExts.length; i++) {
      const filename = tryFile(pathnameWithoutExtension + replacementExts[i], isMain);
      if (filename) {
        return filename;
      }
    }
  }
  return false;
}

// Given a path, check if the file exists with any of the set extensions
function tryExtensions(p, exts, isMain) {
  for (let i = 0; i < exts.length; i++) {
    const filename = tryFile(p + exts[i], isMain);

    if (filename) {
      return filename;
    }
  }
  return false;
}

// This only applies to requests of a specific form:
// 1. name/.*
// 2. @scope/name/.*
const EXPORTS_PATTERN = /^((?:@[^/\\%]+\/)?[^./\\%][^/\\%]*)(\/.*)?$/;
function resolveExports(nmPath, request) {
  // The implementation's behavior is meant to mirror resolution in ESM.
  const { 1: name, 2: expansion = '' } =
    StringPrototypeMatch(request, EXPORTS_PATTERN) || [];
  if (!name)
    return;
  const pkgPath = path.resolve(nmPath, name);
  const pkg = readPackage(pkgPath);
  // if (pkg?.exports != null) {
  if (pkg != null && pkg.exports != null) {
    try {
      return finalizeEsmResolution(packageExportsResolve(
        pathToFileURL(pkgPath + '/package.json'), '.' + expansion, pkg, null,
        cjsConditions).resolved, null, pkgPath);
    } catch (e) {
      if (e.code === 'ERR_MODULE_NOT_FOUND')
        throw createEsmNotFoundErr(request, pkgPath + '/package.json');
      throw e;
    }
  }
}

// Backwards compat for old node versions
const hasModulePathCache = !!require('module')._pathCache;
const Module_pathCache = Object.create(null);
const Module_pathCache_get = hasModulePathCache ? (cacheKey) => Module._pathCache[cacheKey] : (cacheKey) => Module_pathCache[cacheKey];
const Module_pathCache_set = hasModulePathCache ? (cacheKey, value) => (Module._pathCache[cacheKey] = value) : (cacheKey) => (Module_pathCache[cacheKey] = value);

const trailingSlashRegex = /(?:^|\/)\.?\.$/;
const Module_findPath = function _findPath(request, paths, isMain) {
  const absoluteRequest = path.isAbsolute(request);
  if (absoluteRequest) {
    paths = [''];
  } else if (!paths || paths.length === 0) {
    return false;
  }

  const cacheKey = request + '\x00' + ArrayPrototypeJoin(paths, '\x00');
  const entry = Module_pathCache_get(cacheKey);
  if (entry)
    return entry;

  let exts;
  let trailingSlash = request.length > 0 &&
    StringPrototypeCharCodeAt(request, request.length - 1) ===
    CHAR_FORWARD_SLASH;
  if (!trailingSlash) {
    trailingSlash = RegExpPrototypeTest(trailingSlashRegex, request);
  }

  // For each path
  for (let i = 0; i < paths.length; i++) {
    // Don't search further if path doesn't exist
    const curPath = paths[i];
    if (curPath && stat(curPath) < 1) continue;

    if (!absoluteRequest) {
      const exportsResolved = resolveExports(curPath, request);
      if (exportsResolved)
        return exportsResolved;
    }

    const _basePath = path.resolve(curPath, request);
    let filename;

    const [rc, basePath] = statReplacementExtensions(_basePath);
    if (!trailingSlash) {
      if (rc === 0) {  // File.
        if (!isMain) {
          if (preserveSymlinks) {
            filename = path.resolve(basePath);
          } else {
            filename = toRealPath(basePath);
          }
        } else if (preserveSymlinksMain) {
          // For the main module, we use the preserveSymlinksMain flag instead
          // mainly for backward compatibility, as the preserveSymlinks flag
          // historically has not applied to the main module.  Most likely this
          // was intended to keep .bin/ binaries working, as following those
          // symlinks is usually required for the imports in the corresponding
          // files to resolve; that said, in some use cases following symlinks
          // causes bigger problems which is why the preserveSymlinksMain option
          // is needed.
          filename = path.resolve(basePath);
        } else {
          filename = toRealPath(basePath);
        }
      }

      if (!filename) {
        // Try it with each of the extensions
        if (exts === undefined)
          exts = ObjectKeys(Module._extensions);
        filename = tryExtensions(basePath, exts, isMain);
      }
    }

    if (!filename && rc === 1) {  // Directory.
      // try it with each of the extensions at "index"
      if (exts === undefined)
        exts = ObjectKeys(Module._extensions);
      filename = tryPackage(basePath, exts, isMain, request);
    }

    if (filename) {
      Module_pathCache_set(cacheKey, filename);
      return filename;
    }
  }

  return false;
};

function finalizeEsmResolution(resolved, parentPath, pkgPath) {
  if (RegExpPrototypeTest(encodedSepRegEx, resolved))
    throw new ERR_INVALID_MODULE_SPECIFIER(
      resolved, 'must not include encoded "/" or "\\" characters', parentPath);
  const filename = fileURLToPath(resolved);
  const actual = tryReplacementExtensions(filename) || tryFile(filename);
  if (actual)
    return actual;
  const err = createEsmNotFoundErr(filename,
                                   path.resolve(pkgPath, 'package.json'));
  throw err;
}

function createEsmNotFoundErr(request, path) {
  // eslint-disable-next-line no-restricted-syntax
  const err = new Error(`Cannot find module '${request}'`);
  err.code = 'MODULE_NOT_FOUND';
  if (path)
    err.path = path;
  // TODO(BridgeAR): Add the requireStack as well.
  return err;
}


return {
  Module_findPath
}

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
  createCjsLoader,
  assertScriptCanLoadAsCJSImpl
};
