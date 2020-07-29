// Copied from https://raw.githubusercontent.com/nodejs/node/v13.12.0/lib/internal/modules/esm/resolve.js
// Then modified to suite our needs.
// Formatting is intentionally bad to keep the diff as small as possible, to make it easier to merge
// upstream changes and understand our modifications.
'use strict';

const {
  ArrayIsArray,
  JSONParse,
  JSONStringify,
  ObjectGetOwnPropertyNames,
  ObjectPrototypeHasOwnProperty,
  SafeMap,
  StringPrototypeEndsWith,
  StringPrototypeIncludes,
  StringPrototypeIndexOf,
  StringPrototypeSlice,
  StringPrototypeStartsWith,
  StringPrototypeSubstr,
} = {
  ArrayIsArray: Array.isArray,
  JSONParse: JSON.parse,
  JSONStringify: JSON.stringify,
  ObjectGetOwnPropertyNames: Object.getOwnPropertyNames,
  ObjectPrototypeHasOwnProperty: (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop),
  SafeMap: Map,
  StringPrototypeEndsWith: (str, ...rest) => String.prototype.endsWith.apply(str, rest),
  StringPrototypeIncludes: (str, ...rest) => String.prototype.includes.apply(str, rest),
  StringPrototypeIndexOf: (str, ...rest) => String.prototype.indexOf.apply(str, rest),
  StringPrototypeSlice: (str, ...rest) => String.prototype.slice.apply(str, rest),
  StringPrototypeStartsWith: (str, ...rest) => String.prototype.startsWith.apply(str, rest),
  StringPrototypeSubstr: (str, ...rest) => String.prototype.substr.apply(str, rest),
} // node pulls from `primordials` object

// const internalFS = require('internal/fs/utils');
// const { NativeModule } = require('internal/bootstrap/loaders');
const Module = require('module')
const NativeModule = {
  canBeRequiredByUsers(specifier) {
    return Module.builtinModules.includes(specifier)
  }
}
const {
  closeSync,
  fstatSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  Stats,
} = require('fs');
// const { getOptionValue } = require('internal/options');
const { getOptionValue } = require('./node-options');
const { sep } = require('path');

const preserveSymlinks = getOptionValue('--preserve-symlinks');
const preserveSymlinksMain = getOptionValue('--preserve-symlinks-main');
const typeFlag = getOptionValue('--input-type');
// const { URL, pathToFileURL, fileURLToPath } = require('internal/url');
const { URL, pathToFileURL, fileURLToPath } = require('url');
const {
  ERR_INPUT_TYPE_NOT_ALLOWED,
  ERR_INVALID_MODULE_SPECIFIER,
  ERR_INVALID_PACKAGE_CONFIG,
  ERR_INVALID_PACKAGE_TARGET,
  ERR_MODULE_NOT_FOUND,
  ERR_PACKAGE_PATH_NOT_EXPORTED,
  ERR_UNSUPPORTED_ESM_URL_SCHEME,
// } = require('internal/errors').codes;
} = {
  ERR_INPUT_TYPE_NOT_ALLOWED: createErrorCtor('ERR_INPUT_TYPE_NOT_ALLOWED'),
  ERR_INVALID_MODULE_SPECIFIER: createErrorCtor('ERR_INVALID_MODULE_SPECIFIER'),
  ERR_INVALID_PACKAGE_CONFIG: createErrorCtor('ERR_INVALID_PACKAGE_CONFIG'),
  ERR_INVALID_PACKAGE_TARGET: createErrorCtor('ERR_INVALID_PACKAGE_TARGET'),
  ERR_MODULE_NOT_FOUND: createErrorCtor('ERR_MODULE_NOT_FOUND'),
  ERR_PACKAGE_PATH_NOT_EXPORTED: createErrorCtor('ERR_PACKAGE_PATH_NOT_EXPORTED'),
  ERR_UNSUPPORTED_ESM_URL_SCHEME: createErrorCtor('ERR_UNSUPPORTED_ESM_URL_SCHEME'),
}
function createErrorCtor(name) {
  return class CustomError extends Error {
    constructor(...args) {
      super([name, ...args].join(' '))
    }
  }
}

function createResolve(opts) {
// TODO receive cached fs implementations here
const {tsExtensions, jsExtensions, preferTsExts} = opts;

const realpathCache = new SafeMap();
const packageJSONCache = new SafeMap();  /* string -> PackageConfig */

function tryStatSync(path) {
  try {
    return statSync(path);
  } catch {
    return new Stats();
  }
}

function readIfFile(path) {
  let fd;
  try {
    fd = openSync(path, 'r');
  } catch {
    return undefined;
  }
  try {
    if (!fstatSync(fd).isFile()) return undefined;
    return readFileSync(fd, 'utf8');
  } finally {
    closeSync(fd);
  }
}

function getPackageConfig(path, base) {
  const existing = packageJSONCache.get(path);
  if (existing !== undefined) {
    if (!existing.isValid) {
      throw new ERR_INVALID_PACKAGE_CONFIG(path, fileURLToPath(base), false);
    }
    return existing;
  }

  const source = readIfFile(path);
  if (source === undefined) {
    const packageConfig = {
      exists: false,
      main: undefined,
      name: undefined,
      isValid: true,
      type: 'none',
      exports: undefined
    };
    packageJSONCache.set(path, packageConfig);
    return packageConfig;
  }

  let packageJSON;
  try {
    packageJSON = JSONParse(source);
  } catch {
    const packageConfig = {
      exists: true,
      main: undefined,
      name: undefined,
      isValid: false,
      type: 'none',
      exports: undefined
    };
    packageJSONCache.set(path, packageConfig);
    return packageConfig;
  }

  let { main, name, type } = packageJSON;
  const { exports } = packageJSON;
  if (typeof main !== 'string') main = undefined;
  if (typeof name !== 'string') name = undefined;
  // Ignore unknown types for forwards compatibility
  if (type !== 'module' && type !== 'commonjs') type = 'none';

  const packageConfig = {
    exists: true,
    main,
    name,
    isValid: true,
    type,
    exports
  };
  packageJSONCache.set(path, packageConfig);
  return packageConfig;
}

function getPackageScopeConfig(resolved, base) {
  let packageJSONUrl = new URL('./package.json', resolved);
  while (true) {
    const packageJSONPath = packageJSONUrl.pathname;
    if (StringPrototypeEndsWith(packageJSONPath, 'node_modules/package.json'))
      break;
    const packageConfig = getPackageConfig(fileURLToPath(packageJSONUrl), base);
    if (packageConfig.exists) return packageConfig;

    const lastPackageJSONUrl = packageJSONUrl;
    packageJSONUrl = new URL('../package.json', packageJSONUrl);

    // Terminates at root where ../package.json equals ../../package.json
    // (can't just check "/package.json" for Windows support).
    if (packageJSONUrl.pathname === lastPackageJSONUrl.pathname) break;
  }
  const packageConfig = {
    exists: false,
    main: undefined,
    name: undefined,
    isValid: true,
    type: 'none',
    exports: undefined
  };
  packageJSONCache.set(fileURLToPath(packageJSONUrl), packageConfig);
  return packageConfig;
}

/*
 * Legacy CommonJS main resolution:
 * 1. let M = pkg_url + (json main field)
 * 2. TRY(M, M.js, M.json, M.node)
 * 3. TRY(M/index.js, M/index.json, M/index.node)
 * 4. TRY(pkg_url/index.js, pkg_url/index.json, pkg_url/index.node)
 * 5. NOT_FOUND
 */
function fileExists(url) {
  return tryStatSync(fileURLToPath(url)).isFile();
}

function legacyMainResolve(packageJSONUrl, packageConfig) {
  let guess;
  if (packageConfig.main !== undefined) {
    // Note: fs check redundances will be handled by Descriptor cache here.
    if (fileExists(guess = new URL(`./${packageConfig.main}`,
                                   packageJSONUrl))) {
      return guess;
    }
    if (fileExists(guess = new URL(`./${packageConfig.main}.js`,
                                   packageJSONUrl))) {
      return guess;
    }
    if (fileExists(guess = new URL(`./${packageConfig.main}.json`,
                                   packageJSONUrl))) {
      return guess;
    }
    if (fileExists(guess = new URL(`./${packageConfig.main}.node`,
                                   packageJSONUrl))) {
      return guess;
    }
    if (fileExists(guess = new URL(`./${packageConfig.main}/index.js`,
                                   packageJSONUrl))) {
      return guess;
    }
    if (fileExists(guess = new URL(`./${packageConfig.main}/index.json`,
                                   packageJSONUrl))) {
      return guess;
    }
    if (fileExists(guess = new URL(`./${packageConfig.main}/index.node`,
                                   packageJSONUrl))) {
      return guess;
    }
    // Fallthrough.
  }
  if (fileExists(guess = new URL('./index.js', packageJSONUrl))) {
    return guess;
  }
  // So fs.
  if (fileExists(guess = new URL('./index.json', packageJSONUrl))) {
    return guess;
  }
  if (fileExists(guess = new URL('./index.node', packageJSONUrl))) {
    return guess;
  }
  // Not found.
  return undefined;
}

function resolveExtensionsWithTryExactName(search) {
  if (fileExists(search)) return search;
  const resolvedReplacementExtension = resolveReplacementExtensions(search);
  if(resolvedReplacementExtension) return resolvedReplacementExtension;
  return resolveExtensions(search);
}

const extensions = Array.from(new Set([
  ...(preferTsExts ? tsExtensions : []),
  '.js',
  ...jsExtensions,
  '.json', '.node', '.mjs',
  ...tsExtensions
]));

function resolveExtensions(search) {
  for (let i = 0; i < extensions.length; i++) {
    const extension = extensions[i];
    const guess = new URL(`${search.pathname}${extension}`, search);
    if (fileExists(guess)) return guess;
  }
  return undefined;
}

/**
 * TS's resolver can resolve foo.js to foo.ts, by replacing .js extension with several source extensions.
 * IMPORTANT: preserve ordering according to preferTsExts; this affects resolution behavior!
 */
const replacementExtensions = extensions.filter(ext => ['.js', '.jsx', '.ts', '.tsx'].includes(ext));

function resolveReplacementExtensions(search) {
  if (search.pathname.match(/\.js$/)) {
    const pathnameWithoutExtension = search.pathname.slice(0, search.pathname.length - 3);
    for (let i = 0; i < replacementExtensions.length; i++) {
      const extension = replacementExtensions[i];
      const guess = new URL(`${pathnameWithoutExtension}${extension}`, search);
      if (fileExists(guess)) return guess;
    }
  }
  return undefined;
}

function resolveIndex(search) {
  return resolveExtensions(new URL('index', search));
}

function finalizeResolution(resolved, base) {
  if (getOptionValue('--experimental-specifier-resolution') === 'node') {
    let file = resolveExtensionsWithTryExactName(resolved);
    if (file !== undefined) return file;
    if (!StringPrototypeEndsWith(resolved.pathname, '/')) {
      file = resolveIndex(new URL(`${resolved.pathname}/`, base));
    } else {
      file = resolveIndex(resolved);
    }
    if (file !== undefined) return file;
    throw new ERR_MODULE_NOT_FOUND(
      resolved.pathname, fileURLToPath(base), 'module');
  }

  if (StringPrototypeEndsWith(resolved.pathname, '/')) return resolved;

  const file = resolveReplacementExtensions(resolved) || resolved;

  const path = fileURLToPath(file);

  if (!tryStatSync(path).isFile()) {
  throw new ERR_MODULE_NOT_FOUND(
    path || resolved.pathname, fileURLToPath(base), 'module');
  }

  return file;
}

function throwExportsNotFound(subpath, packageJSONUrl, base) {
  throw new ERR_PACKAGE_PATH_NOT_EXPORTED(
    fileURLToPath(packageJSONUrl), subpath, fileURLToPath(base));
}

function throwSubpathInvalid(subpath, packageJSONUrl, base) {
  throw new ERR_INVALID_MODULE_SPECIFIER(
    fileURLToPath(packageJSONUrl), subpath, fileURLToPath(base));
}

function throwExportsInvalid(
  subpath, target, packageJSONUrl, base) {
  if (typeof target === 'object' && target !== null) {
    target = JSONStringify(target, null, '');
  } else if (ArrayIsArray(target)) {
    target = `[${target}]`;
  } else {
    target = `${target}`;
  }
  throw new ERR_INVALID_PACKAGE_TARGET(
    fileURLToPath(packageJSONUrl), null, subpath, target, fileURLToPath(base));
}

function resolveExportsTargetString(
  target, subpath, match, packageJSONUrl, base) {
  if (target[0] !== '.' || target[1] !== '/' ||
      (subpath !== '' && target[target.length - 1] !== '/')) {
    throwExportsInvalid(match, target, packageJSONUrl, base);
  }

  const resolved = new URL(target, packageJSONUrl);
  const resolvedPath = resolved.pathname;
  const packagePath = new URL('.', packageJSONUrl).pathname;

  if (!StringPrototypeStartsWith(resolvedPath, packagePath) ||
      StringPrototypeIncludes(
        resolvedPath, '/node_modules/', packagePath.length - 1)) {
    throwExportsInvalid(match, target, packageJSONUrl, base);
  }

  if (subpath === '') return resolved;
  const subpathResolved = new URL(subpath, resolved);
  const subpathResolvedPath = subpathResolved.pathname;
  if (!StringPrototypeStartsWith(subpathResolvedPath, resolvedPath) ||
      StringPrototypeIncludes(subpathResolvedPath,
                              '/node_modules/', packagePath.length - 1)) {
    throwSubpathInvalid(match + subpath, packageJSONUrl, base);
  }
  return subpathResolved;
}

function isArrayIndex(key /* string */) { /* -> boolean */
  const keyNum = +key;
  if (`${keyNum}` !== key) return false;
  return keyNum >= 0 && keyNum < 0xFFFF_FFFF;
}

function resolveExportsTarget(
  packageJSONUrl, target, subpath, packageSubpath, base) {
  if (typeof target === 'string') {
    const resolved = resolveExportsTargetString(
      target, subpath, packageSubpath, packageJSONUrl, base);
    return finalizeResolution(resolved, base);
  } else if (ArrayIsArray(target)) {
    if (target.length === 0)
      throwExportsInvalid(packageSubpath, target, packageJSONUrl, base);

    let lastException;
    for (let i = 0; i < target.length; i++) {
      const targetItem = target[i];
      let resolved;
      try {
        resolved = resolveExportsTarget(
          packageJSONUrl, targetItem, subpath, packageSubpath, base);
      } catch (e) {
        lastException = e;
        if (e.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ||
            e.code === 'ERR_INVALID_PACKAGE_TARGET') {
          continue;
        }
        throw e;
      }

      return finalizeResolution(resolved, base);
    }
    throw lastException;
  } else if (typeof target === 'object' && target !== null) {
    const keys = ObjectGetOwnPropertyNames(target);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (isArrayIndex(key)) {
        throw new ERR_INVALID_PACKAGE_CONFIG(
          fileURLToPath(packageJSONUrl),
          '"exports" cannot contain numeric property keys');
      }
    }
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key === 'node' || key === 'import' || key === 'default') {
        const conditionalTarget = target[key];
        try {
          return resolveExportsTarget(
            packageJSONUrl, conditionalTarget, subpath, packageSubpath, base);
        } catch (e) {
          if (e.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') continue;
          throw e;
        }
      }
    }
    throwExportsNotFound(packageSubpath, packageJSONUrl, base);
  }
  throwExportsInvalid(packageSubpath, target, packageJSONUrl, base);
}

function isConditionalExportsMainSugar(exports, packageJSONUrl, base) {
  if (typeof exports === 'string' || ArrayIsArray(exports)) return true;
  if (typeof exports !== 'object' || exports === null) return false;

  const keys = ObjectGetOwnPropertyNames(exports);
  let isConditionalSugar = false;
  let i = 0;
  for (let j = 0; j < keys.length; j++) {
    const key = keys[j];
    const curIsConditionalSugar = key === '' || key[0] !== '.';
    if (i++ === 0) {
      isConditionalSugar = curIsConditionalSugar;
    } else if (isConditionalSugar !== curIsConditionalSugar) {
      throw new ERR_INVALID_PACKAGE_CONFIG(
        fileURLToPath(packageJSONUrl),
        '"exports" cannot contain some keys starting with \'.\' and some not.' +
        ' The exports object must either be an object of package subpath keys' +
        ' or an object of main entry condition name keys only.');
    }
  }
  return isConditionalSugar;
}


function packageMainResolve(packageJSONUrl, packageConfig, base) {
  if (packageConfig.exists) {
    const exports = packageConfig.exports;
    if (exports !== undefined) {
      if (isConditionalExportsMainSugar(exports, packageJSONUrl, base)) {
        return resolveExportsTarget(packageJSONUrl, exports, '', '', base);
      } else if (typeof exports === 'object' && exports !== null) {
        const target = exports['.'];
        if (target !== undefined)
          return resolveExportsTarget(packageJSONUrl, target, '', '', base);
      }

      throw new ERR_PACKAGE_PATH_NOT_EXPORTED(packageJSONUrl, '.');
    }
    if (packageConfig.main !== undefined) {
      const resolved = new URL(packageConfig.main, packageJSONUrl);
      const path = fileURLToPath(resolved);
      if (tryStatSync(path).isFile()) return resolved;
    }
    if (getOptionValue('--experimental-specifier-resolution') === 'node') {
      if (packageConfig.main !== undefined) {
        return finalizeResolution(
          new URL(packageConfig.main, packageJSONUrl), base);
      } else {
        return finalizeResolution(
          new URL('index', packageJSONUrl), base);
      }
    }
    if (packageConfig.type !== 'module') {
      return legacyMainResolve(packageJSONUrl, packageConfig);
    }
  }

  throw new ERR_MODULE_NOT_FOUND(
    fileURLToPath(new URL('.', packageJSONUrl)), fileURLToPath(base));
}


function packageExportsResolve(
  packageJSONUrl, packageSubpath, packageConfig, base) /* -> URL */ {
  const exports = packageConfig.exports;
  if (exports === undefined ||
      isConditionalExportsMainSugar(exports, packageJSONUrl, base)) {
    throwExportsNotFound(packageSubpath, packageJSONUrl, base);
  }


  if (ObjectPrototypeHasOwnProperty(exports, packageSubpath)) {
    const target = exports[packageSubpath];
    const resolved = resolveExportsTarget(
      packageJSONUrl, target, '', packageSubpath, base);
    return finalizeResolution(resolved, base);
  }

  let bestMatch = '';
  const keys = ObjectGetOwnPropertyNames(exports);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key[key.length - 1] !== '/') continue;
    if (StringPrototypeStartsWith(packageSubpath, key) &&
        key.length > bestMatch.length) {
      bestMatch = key;
    }
  }

  if (bestMatch) {
    const target = exports[bestMatch];
    const subpath = StringPrototypeSubstr(packageSubpath, bestMatch.length);
    const resolved = resolveExportsTarget(
      packageJSONUrl, target, subpath, packageSubpath, base);
    return finalizeResolution(resolved, base);
  }

  throwExportsNotFound(packageSubpath, packageJSONUrl, base);
}

function getPackageType(url) {
  const packageConfig = getPackageScopeConfig(url, url);
  return packageConfig.type;
}

function packageResolve(specifier /* string */, base /* URL */) { /* -> URL */
  let separatorIndex = StringPrototypeIndexOf(specifier, '/');
  let validPackageName = true;
  let isScoped = false;
  if (specifier[0] === '@') {
    isScoped = true;
    if (separatorIndex === -1 || specifier.length === 0) {
      validPackageName = false;
    } else {
      separatorIndex = StringPrototypeIndexOf(
        specifier, '/', separatorIndex + 1);
    }
  }

  const packageName = separatorIndex === -1 ?
    specifier : StringPrototypeSlice(specifier, 0, separatorIndex);

  // Package name cannot have leading . and cannot have percent-encoding or
  // separators.
  for (let i = 0; i < packageName.length; i++) {
    if (packageName[i] === '%' || packageName[i] === '\\') {
      validPackageName = false;
      break;
    }
  }

  if (!validPackageName) {
    throw new ERR_INVALID_MODULE_SPECIFIER(
      specifier, undefined, fileURLToPath(base));
  }

  const packageSubpath = separatorIndex === -1 ?
    '' : '.' + StringPrototypeSlice(specifier, separatorIndex);

  // ResolveSelf
  const packageConfig = getPackageScopeConfig(base, base);
  if (packageConfig.exists) {
    // TODO(jkrems): Find a way to forward the pair/iterator already generated
    // while executing GetPackageScopeConfig
    let packageJSONUrl;
    for (const [ filename, packageConfigCandidate ] of packageJSONCache) {
      if (packageConfig === packageConfigCandidate) {
        packageJSONUrl = pathToFileURL(filename);
        break;
      }
    }
    if (packageJSONUrl !== undefined &&
        packageConfig.name === packageName &&
        packageConfig.exports !== undefined) {
      if (packageSubpath === './') {
        return new URL('./', packageJSONUrl);
      } else if (packageSubpath === '') {
        return packageMainResolve(packageJSONUrl, packageConfig, base);
      } else {
        return packageExportsResolve(
          packageJSONUrl, packageSubpath, packageConfig, base);
      }
    }
  }

  let packageJSONUrl =
    new URL('./node_modules/' + packageName + '/package.json', base);
  let packageJSONPath = fileURLToPath(packageJSONUrl);
  let lastPath;
  do {
    const stat = tryStatSync(
      StringPrototypeSlice(packageJSONPath, 0, packageJSONPath.length - 13));
    if (!stat.isDirectory()) {
      lastPath = packageJSONPath;
      packageJSONUrl = new URL((isScoped ?
        '../../../../node_modules/' : '../../../node_modules/') +
        packageName + '/package.json', packageJSONUrl);
      packageJSONPath = fileURLToPath(packageJSONUrl);
      continue;
    }

    // Package match.
    const packageConfig = getPackageConfig(packageJSONPath, base);
    if (packageSubpath === './') {
      return new URL('./', packageJSONUrl);
    } else if (packageSubpath === '') {
      return packageMainResolve(packageJSONUrl, packageConfig, base);
    } else if (packageConfig.exports !== undefined) {
      return packageExportsResolve(
        packageJSONUrl, packageSubpath, packageConfig, base);
    } else {
      return finalizeResolution(
        new URL(packageSubpath, packageJSONUrl), base);
    }
    // Cross-platform root check.
  } while (packageJSONPath.length !== lastPath.length);

  // eslint can't handle the above code.
  // eslint-disable-next-line no-unreachable
  throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base));
}

function shouldBeTreatedAsRelativeOrAbsolutePath(specifier) {
  if (specifier === '') return false;
  if (specifier[0] === '/') return true;
  if (specifier[0] === '.') {
    if (specifier.length === 1 || specifier[1] === '/') return true;
    if (specifier[1] === '.') {
      if (specifier.length === 2 || specifier[2] === '/') return true;
    }
  }
  return false;
}

function moduleResolve(specifier /* string */, base /* URL */) { /* -> URL */
  // Order swapped from spec for minor perf gain.
  // Ok since relative URLs cannot parse as URLs.
  let resolved;
  if (shouldBeTreatedAsRelativeOrAbsolutePath(specifier)) {
    resolved = new URL(specifier, base);
  } else {
    try {
      resolved = new URL(specifier);
    } catch {
      return packageResolve(specifier, base);
    }
  }
  return finalizeResolution(resolved, base);
}

function defaultResolve(specifier, { parentURL } = {}, defaultResolveUnused) {
  let parsed;
  try {
    parsed = new URL(specifier);
    if (parsed.protocol === 'data:') {
      return {
        url: specifier
      };
    }
  } catch {}
  if (parsed && parsed.protocol === 'nodejs:')
    return { url: specifier };
  if (parsed && parsed.protocol !== 'file:' && parsed.protocol !== 'data:')
    throw new ERR_UNSUPPORTED_ESM_URL_SCHEME();
  if (NativeModule.canBeRequiredByUsers(specifier)) {
    return {
      url: 'nodejs:' + specifier
    };
  }
  if (parentURL && StringPrototypeStartsWith(parentURL, 'data:')) {
    // This is gonna blow up, we want the error
    new URL(specifier, parentURL);
  }

  const isMain = parentURL === undefined;
  if (isMain) {
    parentURL = pathToFileURL(`${process.cwd()}/`).href;

    // This is the initial entry point to the program, and --input-type has
    // been passed as an option; but --input-type can only be used with
    // --eval, --print or STDIN string input. It is not allowed with file
    // input, to avoid user confusion over how expansive the effect of the
    // flag should be (i.e. entry point only, package scope surrounding the
    // entry point, etc.).
    if (typeFlag)
      throw new ERR_INPUT_TYPE_NOT_ALLOWED();
  }

  let url = moduleResolve(specifier, new URL(parentURL));

  if (isMain ? !preserveSymlinksMain : !preserveSymlinks) {
    const urlPath = fileURLToPath(url);
    const real = realpathSync(urlPath, {
      // [internalFS.realpathCacheKey]: realpathCache
    });
    const old = url;
    url = pathToFileURL(real + (urlPath.endsWith(sep) ? '/' : ''));
    url.search = old.search;
    url.hash = old.hash;
  }

  return { url: `${url}` };
}

return {
  defaultResolve,
  getPackageType
};
}
module.exports = {
  createResolve
}
