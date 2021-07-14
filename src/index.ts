import { Module } from 'module';
import { relative, basename, extname, resolve, dirname, join, delimiter as pathDelimiter } from 'path';
import * as util from 'util';
import { fileURLToPath } from 'url';

import * as ynModule from 'yn';
import sourceMapSupport = require('source-map-support');
import { BaseError } from 'make-error';
import type * as _ts from 'typescript';

import type { Transpiler, TranspilerFactory } from './transpilers/types';
import {
  assign,
  cachedLookup,
  normalizeSlashes,
  parse,
  split,
  yn,
} from './util';
import { readConfig } from './configuration';
import type { TSCommon, TSInternal } from './ts-compiler-types';
import {
  createModuleTypeClassifier,
  ModuleTypeClassifier,
} from './module-type-classifier';
import { createResolverFunctions } from './resolver-functions';

export { TSCommon };
export { createRepl, CreateReplOptions, ReplService } from './repl';
export type {
  TranspilerModule,
  TranspilerFactory,
  CreateTranspilerOptions,
  TranspileOutput,
  TranspileOptions,
  Transpiler,
} from './transpilers/types';

/**
 * Does this version of node obey the package.json "type" field
 * and throw ERR_REQUIRE_ESM when attempting to require() an ESM modules.
 */
const engineSupportsPackageTypeField =
  parseInt(process.versions.node.split('.')[0], 10) >= 12;

/**
 * Assert that script can be loaded as CommonJS when we attempt to require it.
 * If it should be loaded as ESM, throw ERR_REQUIRE_ESM like node does.
 *
 * Loaded conditionally so we don't need to support older node versions
 */
let assertScriptCanLoadAsCJS: (
  service: Service,
  module: NodeJS.Module,
  filename: string
) => void = engineSupportsPackageTypeField
  ? require('../dist-raw/node-cjs-loader-utils').assertScriptCanLoadAsCJSImpl
  : () => {
      /* noop */
    };

/**
 * Registered `ts-node` instance information.
 */
export const REGISTER_INSTANCE = Symbol.for('ts-node.register.instance');

/**
 * Expose `REGISTER_INSTANCE` information on node.js `process`.
 */
declare global {
  namespace NodeJS {
    interface Process {
      [REGISTER_INSTANCE]?: Service;
    }
  }
}

/** @internal */
export const env = process.env as ProcessEnv;
/**
 * Declare all env vars, to aid discoverability.
 * If an env var affects ts-node's behavior, it should not be buried somewhere in our codebase.
 * @internal
 */
export interface ProcessEnv {
  TS_NODE_DEBUG?: string;
  TS_NODE_CWD?: string;
  /** @deprecated */
  TS_NODE_DIR?: string;
  TS_NODE_EMIT?: string;
  TS_NODE_SCOPE?: string;
  TS_NODE_SCOPE_DIR?: string;
  TS_NODE_FILES?: string;
  TS_NODE_PRETTY?: string;
  TS_NODE_COMPILER?: string;
  TS_NODE_COMPILER_OPTIONS?: string;
  TS_NODE_IGNORE?: string;
  TS_NODE_PROJECT?: string;
  TS_NODE_SKIP_PROJECT?: string;
  TS_NODE_SKIP_IGNORE?: string;
  TS_NODE_PREFER_TS_EXTS?: string;
  TS_NODE_IGNORE_DIAGNOSTICS?: string;
  TS_NODE_TRANSPILE_ONLY?: string;
  TS_NODE_TYPE_CHECK?: string;
  TS_NODE_COMPILER_HOST?: string;
  TS_NODE_LOG_ERROR?: string;
  TS_NODE_HISTORY?: string;

  NODE_NO_READLINE?: string;
}

/**
 * @internal
 */
export const INSPECT_CUSTOM = util.inspect.custom || 'inspect';

/**
 * Debugging `ts-node`.
 */
const shouldDebug = yn(env.TS_NODE_DEBUG);
/** @internal */
export const debug = shouldDebug
  ? (...args: any) =>
      console.log(`[ts-node ${new Date().toISOString()}]`, ...args)
  : () => undefined;
const debugFn = shouldDebug
  ? <T, U>(key: string, fn: (arg: T) => U) => {
      let i = 0;
      return (x: T) => {
        debug(key, x, ++i);
        return fn(x);
      };
    }
  : <T, U>(_: string, fn: (arg: T) => U) => fn;

/**
 * Export the current version.
 */
export const VERSION = require('../package.json').version;

/**
 * Options for creating a new TypeScript compiler instance.
 */
export interface CreateOptions {
  /**
   * Behave as if invoked within this working directory.  Roughly equivalent to `cd $dir && ts-node ...`
   *
   * @default process.cwd()
   */
  cwd?: string;
  /**
   * Legacy alias for `cwd`
   *
   * @deprecated use `projectSearchDir` or `cwd`
   */
  dir?: string;
  /**
   * Emit output files into `.ts-node` directory.
   *
   * @default false
   */
  emit?: boolean;
  /**
   * Scope compiler to files within `scopeDir`.
   *
   * @default false
   */
  scope?: boolean;
  /**
   * @default First of: `tsconfig.json` "rootDir" if specified, directory containing `tsconfig.json`, or cwd if no `tsconfig.json` is loaded.
   */
  scopeDir?: string;
  /**
   * Use pretty diagnostic formatter.
   *
   * @default false
   */
  pretty?: boolean;
  /**
   * Use TypeScript's faster `transpileModule`.
   *
   * @default false
   */
  transpileOnly?: boolean;
  /**
   * **DEPRECATED** Specify type-check is enabled (e.g. `transpileOnly == false`).
   *
   * @default true
   */
  typeCheck?: boolean;
  /**
   * Use TypeScript's compiler host API instead of the language service API.
   *
   * @default false
   */
  compilerHost?: boolean;
  /**
   * Logs TypeScript errors to stderr instead of throwing exceptions.
   *
   * @default false
   */
  logError?: boolean;
  /**
   * Load "files" and "include" from `tsconfig.json` on startup.
   *
   * Default is to override `tsconfig.json` "files" and "include" to only include the entrypoint script.
   *
   * @default false
   */
  files?: boolean;
  /**
   * Specify a custom TypeScript compiler.
   *
   * @default "typescript"
   */
  compiler?: string;
  /**
   * Specify a custom transpiler for use with transpileOnly
   */
  transpiler?: string | [string, object];
  /**
   * Paths which should not be compiled.
   *
   * Each string in the array is converted to a regular expression via `new RegExp()` and tested against source paths prior to compilation.
   *
   * Source paths are normalized to posix-style separators, relative to the directory containing `tsconfig.json` or to cwd if no `tsconfig.json` is loaded.
   *
   * Default is to ignore all node_modules subdirectories.
   *
   * @default ["(?:^|/)node_modules/"]
   */
  ignore?: string[];
  /**
   * Path to TypeScript config file or directory containing a `tsconfig.json`.
   * Similar to the `tsc --project` flag: https://www.typescriptlang.org/docs/handbook/compiler-options.html
   */
  project?: string;
  /**
   * Search for TypeScript config file (`tsconfig.json`) in this or parent directories.
   */
  projectSearchDir?: string;
  /**
   * Skip project config resolution and loading.
   *
   * @default false
   */
  skipProject?: boolean;
  /**
   * Skip ignore check, so that compilation will be attempted for all files with matching extensions.
   *
   * @default false
   */
  skipIgnore?: boolean;
  /**
   * JSON object to merge with TypeScript `compilerOptions`.
   *
   * @allOf [{"$ref": "https://schemastore.azurewebsites.net/schemas/json/tsconfig.json#definitions/compilerOptionsDefinition/properties/compilerOptions"}]
   */
  compilerOptions?: object;
  /**
   * Ignore TypeScript warnings by diagnostic code.
   */
  ignoreDiagnostics?: Array<number | string>;
  /**
   * Modules to require, like node's `--require` flag.
   *
   * If specified in `tsconfig.json`, the modules will be resolved relative to the `tsconfig.json` file.
   *
   * If specified programmatically, each input string should be pre-resolved to an absolute path for
   * best results.
   */
  require?: Array<string>;
  readFile?: ReadFileFunction;
  fileExists?: FileExistsFunction;
  transformers?:
    | _ts.CustomTransformers
    | ((p: _ts.Program) => _ts.CustomTransformers);
  /**
   * True if require() hooks should interop with experimental ESM loader.
   * Enabled explicitly via a flag since it is a breaking change.
   * @internal
   */
  experimentalEsmLoader?: boolean;
  /**
   * Override certain paths to be compiled and executed as CommonJS or ECMAScript modules.
   * When overridden, the tsconfig "module" and package.json "type" fields are overridden.
   * This is useful because TypeScript files cannot use the .cjs nor .mjs file extensions;
   * it achieves the same effect.
   *
   * Each key is a glob pattern following the same rules as tsconfig's "include" array.
   * When multiple patterns match the same file, the last pattern takes precedence.
   *
   * `cjs` overrides matches files to compile and execute as CommonJS.
   * `esm` overrides matches files to compile and execute as native ECMAScript modules.
   * `package` overrides either of the above to default behavior, which obeys package.json "type" and
   * tsconfig.json "module" options.
   */
  moduleTypes?: Record<string, 'cjs' | 'esm' | 'package'>;
  /**
   * @internal
   * Set by our configuration loader whenever a config file contains options that
   * are relative to the config file they came from, *and* when other logic needs
   * to know this.  Some options can be eagerly resolved to absolute paths by
   * the configuration loader, so it is *not* necessary for their source to be set here.
   */
  optionBasePaths?: OptionBasePaths;
}

/** @internal */
export interface OptionBasePaths {
  moduleTypes?: string;
}

/**
 * Options for registering a TypeScript compiler instance globally.
 */
export interface RegisterOptions extends CreateOptions {
  /**
   * Re-order file extensions so that TypeScript imports are preferred.
   *
   * For example, when both `index.js` and `index.ts` exist, enabling this option causes `require('./index')` to resolve to `index.ts` instead of `index.js`
   *
   * @default false
   */
  preferTsExts?: boolean;
}

/**
 * Must be an interface to support `typescript-json-schema`.
 */
export interface TsConfigOptions
  extends Omit<
    RegisterOptions,
    | 'transformers'
    | 'readFile'
    | 'fileExists'
    | 'skipProject'
    | 'project'
    | 'dir'
    | 'cwd'
    | 'projectSearchDir'
    | 'experimentalEsmLoader'
    | 'optionBasePaths'
  > {}

export type ReadFileFunction = (path: string) => string | undefined;
export type FileExistsFunction = (path: string) => boolean;

/**
 * Information retrieved from type info check.
 */
export interface TypeInfo {
  name: string;
  comment: string;
}

/**
 * Default register options, including values specified via environment
 * variables.
 * @internal
 */
export const DEFAULTS: RegisterOptions = {
  cwd: env.TS_NODE_CWD ?? env.TS_NODE_DIR,
  emit: yn(env.TS_NODE_EMIT),
  scope: yn(env.TS_NODE_SCOPE),
  scopeDir: env.TS_NODE_SCOPE_DIR,
  files: yn(env.TS_NODE_FILES),
  pretty: yn(env.TS_NODE_PRETTY),
  compiler: env.TS_NODE_COMPILER,
  compilerOptions: parse(env.TS_NODE_COMPILER_OPTIONS),
  ignore: split(env.TS_NODE_IGNORE),
  project: env.TS_NODE_PROJECT,
  skipProject: yn(env.TS_NODE_SKIP_PROJECT),
  skipIgnore: yn(env.TS_NODE_SKIP_IGNORE),
  preferTsExts: yn(env.TS_NODE_PREFER_TS_EXTS),
  ignoreDiagnostics: split(env.TS_NODE_IGNORE_DIAGNOSTICS),
  transpileOnly: yn(env.TS_NODE_TRANSPILE_ONLY),
  typeCheck: yn(env.TS_NODE_TYPE_CHECK),
  compilerHost: yn(env.TS_NODE_COMPILER_HOST),
  logError: yn(env.TS_NODE_LOG_ERROR),
  experimentalEsmLoader: false,
};

/**
 * TypeScript diagnostics error.
 */
export class TSError extends BaseError {
  name = 'TSError';

  constructor(public diagnosticText: string, public diagnosticCodes: number[]) {
    super(`⨯ Unable to compile TypeScript:\n${diagnosticText}`);
  }

  /**
   * @internal
   */
  [INSPECT_CUSTOM]() {
    return this.diagnosticText;
  }
}

/**
 * Primary ts-node service, which wraps the TypeScript API and can compile TypeScript to JavaScript
 */
export interface Service {
  ts: TSCommon;
  config: _ts.ParsedCommandLine;
  options: RegisterOptions;
  enabled(enabled?: boolean): boolean;
  ignored(fileName: string): boolean;
  compile(code: string, fileName: string, lineOffset?: number): string;
  getTypeInfo(code: string, fileName: string, position: number): TypeInfo;
  /** @internal */
  configFilePath: string | undefined;
  /** @internal */
  moduleTypeClassifier: ModuleTypeClassifier;
}

/**
 * Re-export of `Service` interface for backwards-compatibility
 * @deprecated use `Service` instead
 * @see {Service}
 */
export type Register = Service;

/** @internal */
export function getExtensions(config: _ts.ParsedCommandLine) {
  const tsExtensions = ['.ts'];
  const jsExtensions = [];

  // Enable additional extensions when JSX or `allowJs` is enabled.
  if (config.options.jsx) tsExtensions.push('.tsx');
  if (config.options.allowJs) jsExtensions.push('.js');
  if (config.options.jsx && config.options.allowJs) jsExtensions.push('.jsx');
  return { tsExtensions, jsExtensions };
}

/**
 * Register TypeScript compiler instance onto node.js
 */
export function register(opts: RegisterOptions = {}): Service {
  const originalJsHandler = require.extensions['.js'];
  const service = create(opts);
  const { tsExtensions, jsExtensions } = getExtensions(service.config);
  const extensions = [...tsExtensions, ...jsExtensions];

  // Expose registered instance globally.
  process[REGISTER_INSTANCE] = service;

  // Register the extensions.
  registerExtensions(
    service.options.preferTsExts,
    extensions,
    service,
    originalJsHandler
  );

  // Require specified modules before start-up.
  (Module as any)._preloadModules(service.options.require);

  return service;
}

/**
 * Create TypeScript compiler instance.
 */
export function create(rawOptions: CreateOptions = {}): Service {
  const cwd = resolve(
    rawOptions.cwd ?? rawOptions.dir ?? DEFAULTS.cwd ?? process.cwd()
  );
  const compilerName = rawOptions.compiler ?? DEFAULTS.compiler;

  /**
   * Load the typescript compiler. It is required to load the tsconfig but might
   * be changed by the tsconfig, so we have to do this twice.
   */
  function loadCompiler(name: string | undefined, relativeToPath: string) {
    const compiler = require.resolve(name || 'typescript', {
      paths: [relativeToPath, __dirname],
    });
    const ts: typeof _ts = require(compiler);
    return { compiler, ts };
  }

  // Compute minimum options to read the config file.
  let { compiler, ts } = loadCompiler(
    compilerName,
    rawOptions.projectSearchDir ?? rawOptions.project ?? cwd
  );

  // Read config file and merge new options between env and CLI options.
  const {
    configFilePath,
    config,
    tsNodeOptionsFromTsconfig,
    optionBasePaths,
  } = readConfig(cwd, ts, rawOptions);
  const options = assign<RegisterOptions>(
    {},
    DEFAULTS,
    tsNodeOptionsFromTsconfig || {},
    { optionBasePaths },
    rawOptions
  );
  options.require = [
    ...(tsNodeOptionsFromTsconfig.require || []),
    ...(rawOptions.require || []),
  ];

  // Re-load the compiler in case it has changed.
  // Compiler is loaded relative to tsconfig.json, so tsconfig discovery may cause us to load a
  // different compiler than we did above, even if the name has not changed.
  if (configFilePath) {
    ({ compiler, ts } = loadCompiler(options.compiler, configFilePath));
  }

  const readFile = options.readFile || ts.sys.readFile;
  const fileExists = options.fileExists || ts.sys.fileExists;
  // typeCheck can override transpileOnly, useful for CLI flag to override config file
  const transpileOnly =
    options.transpileOnly === true && options.typeCheck !== true;
  const transformers = options.transformers || undefined;
  const ignoreDiagnostics = [
    6059, // "'rootDir' is expected to contain all source files."
    18002, // "The 'files' list in config file is empty."
    18003, // "No inputs were found in config file."
    ...(options.ignoreDiagnostics || []),
  ].map(Number);

  const configDiagnosticList = filterDiagnostics(
    config.errors,
    ignoreDiagnostics
  );
  const outputCache = new Map<
    string,
    {
      content: string;
    }
  >();

  const configFileDirname = configFilePath ? dirname(configFilePath) : null;
  const scopeDir =
    options.scopeDir ?? config.options.rootDir ?? configFileDirname ?? cwd;
  const ignoreBaseDir = configFileDirname ?? cwd;
  const isScoped = options.scope
    ? (fileName: string) => relative(scopeDir, fileName).charAt(0) !== '.'
    : () => true;
  const shouldIgnore = createIgnore(
    ignoreBaseDir,
    options.skipIgnore
      ? []
      : (options.ignore || ['(?:^|/)node_modules/']).map(
          (str) => new RegExp(str)
        )
  );

  const diagnosticHost: _ts.FormatDiagnosticsHost = {
    getNewLine: () => ts.sys.newLine,
    getCurrentDirectory: () => cwd,
    getCanonicalFileName: ts.sys.useCaseSensitiveFileNames
      ? (x) => x
      : (x) => x.toLowerCase(),
  };

  if (options.transpileOnly && typeof transformers === 'function') {
    throw new TypeError(
      'Transformers function is unavailable in "--transpile-only"'
    );
  }
  let customTranspiler: Transpiler | undefined = undefined;
  if (options.transpiler) {
    if (!transpileOnly)
      throw new Error(
        'Custom transpiler can only be used when transpileOnly is enabled.'
      );
    const transpilerName =
      typeof options.transpiler === 'string'
        ? options.transpiler
        : options.transpiler[0];
    const transpilerOptions =
      typeof options.transpiler === 'string' ? {} : options.transpiler[1] ?? {};
    // TODO mimic fixed resolution logic from loadCompiler main
    // TODO refactor into a more generic "resolve dep relative to project" helper
    const transpilerPath = require.resolve(transpilerName, {
      paths: [cwd, __dirname],
    });
    const transpilerFactory: TranspilerFactory = require(transpilerPath).create;
    customTranspiler = transpilerFactory({
      service: { options, config },
      ...transpilerOptions,
    });
  }

  // Install source map support and read from memory cache.
  sourceMapSupport.install({
    environment: 'node',
    retrieveFile(pathOrUrl: string) {
      let path = pathOrUrl;
      // If it's a file URL, convert to local path
      // Note: fileURLToPath does not exist on early node v10
      // I could not find a way to handle non-URLs except to swallow an error
      if (options.experimentalEsmLoader && path.startsWith('file://')) {
        try {
          path = fileURLToPath(path);
        } catch (e) {
          /* swallow error */
        }
      }
      path = normalizeSlashes(path);
      return outputCache.get(path)?.content || '';
    },
  });

  const formatDiagnostics =
    process.stdout.isTTY || options.pretty
      ? ts.formatDiagnosticsWithColorAndContext || ts.formatDiagnostics
      : ts.formatDiagnostics;

  function createTSError(diagnostics: ReadonlyArray<_ts.Diagnostic>) {
    const diagnosticText = formatDiagnostics(diagnostics, diagnosticHost);
    const diagnosticCodes = diagnostics.map((x) => x.code);
    return new TSError(diagnosticText, diagnosticCodes);
  }

  function reportTSError(configDiagnosticList: _ts.Diagnostic[]) {
    const error = createTSError(configDiagnosticList);
    if (options.logError) {
      // Print error in red color and continue execution.
      console.error('\x1b[31m%s\x1b[0m', error);
    } else {
      // Throw error and exit the script.
      throw error;
    }
  }

  // Render the configuration errors.
  if (configDiagnosticList.length) reportTSError(configDiagnosticList);

  /**
   * Get the extension for a transpiled file.
   */
  const getExtension =
    config.options.jsx === ts.JsxEmit.Preserve
      ? (path: string) => (/\.[tj]sx$/.test(path) ? '.jsx' : '.js')
      : (_: string) => '.js';

  type GetOutputFunction = (code: string, fileName: string) => SourceOutput;
  /**
   * Create the basic required function using transpile mode.
   */
  let getOutput: GetOutputFunction;
  let getTypeInfo: (
    _code: string,
    _fileName: string,
    _position: number
  ) => TypeInfo;

  const getCanonicalFileName = ((ts as unknown) as TSInternal).createGetCanonicalFileName(
    ts.sys.useCaseSensitiveFileNames
  );

  const moduleTypeClassifier = createModuleTypeClassifier({
    basePath: options.optionBasePaths?.moduleTypes,
    patterns: options.moduleTypes,
  });

  /**
   * Create filesystem access functions which implement appropriate caching and
   * are usable in `*Host` implementations.
   */
  function createCachedFilesystem(opts: {
    readFile: ReadFileFunction;
    fileExists: FileExistsFunction;
  }) {
    const { readFile: _readFile, fileExists: _fileExists } = opts;

    const fileExistsCache = new Map<string, boolean>();
    const fileExists = cachedLookup(debugFn('fileExists', _fileExists), fileExistsCache);
    const readFileCache = new Map<string, string | undefined>();
    const readFile = cachedLookup(debugFn('readFile', _readFile), readFileCache);
    function setFileContents(path: string, content: string | undefined) {
      readFileCache.set(path, content);
      fileExistsCache.set(path, true);
    }
    // Not cached until TS exposes a proper way to inject fs dependencies so that
    // this function obeys our readFile, etc caches.
    const readDirectory = (path: string, extensions?: readonly string[], exclude?: readonly string[], include?: readonly string[], depth?: number): string[] => {
      debug('readDirectory', path, extensions, exclude, include, depth);
      return ts.sys.readDirectory(path, extensions, exclude, include, depth);
    }
    const getDirectories = cachedLookup(
      debugFn('getDirectories', ts.sys.getDirectories)
    );
    const directoryExists = cachedLookup(
      debugFn('directoryExists', ts.sys.directoryExists)
    );
    // Cache probably has little effect; this is an in-memory transformation based on CWD
    const resolvePath = debugFn('resolvePath', ts.sys.resolvePath);
    // Note: cache does not understand when intermediate symlinks are changed; cannot be invalidated correctly.
    const realpath = ts.sys.realpath
      ? cachedLookup(debugFn('realpath', ts.sys.realpath))
      : undefined;

    return {
      readFile,
      readDirectory,
      getDirectories,
      fileExists,
      directoryExists,
      resolvePath,
      realpath,
      setFileContents,
      fileContents: readFileCache,
    };

    function cachedLookup<T>(fn: (arg: string) => T, cache = new Map<string, T>()): (arg: string) => T {
      return (arg: string): T => {
        if (!cache.has(arg)) {
          cache.set(arg, fn(arg));
        }

        return cache.get(arg)!;
      };
    }
  }

  function createUpdateMemoryCacheFunction(opts: {
    onProjectMustUpdate: () => void;
    isFileKnownToBeInternal: ReturnType<
      typeof createResolverFunctions
    >['isFileKnownToBeInternal'];
    markBucketOfFilenameInternal: ReturnType<
      typeof createResolverFunctions
    >['markBucketOfFilenameInternal'];
    rootFileNames: Set<string>;
    fileVersions: Map<string, number>;
    fileContents: Map<string, string | undefined>;
    setFileContents(path: string, contents: string | undefined): void;
  }) {
    const {
      onProjectMustUpdate,
      isFileKnownToBeInternal,
      fileContents,
      setFileContents,
      fileVersions,
      markBucketOfFilenameInternal,
      rootFileNames,
    } = opts;
    const updateMemoryCache = (contents: string, fileName: string) => {
      let projectMustUpdate = false;
      // Add to `rootFiles` as necessary, either to make TS include a file it has not seen,
      // or to trigger a re-classification of files from external to internal.
      if (!rootFileNames.has(fileName) && !isFileKnownToBeInternal(fileName)) {
        markBucketOfFilenameInternal(fileName);
        rootFileNames.add(fileName);
        projectMustUpdate = true;
      }

      const previousVersion = fileVersions.get(fileName) || 0;
      const previousContents = fileContents.get(fileName);
      // Avoid incrementing cache when nothing has changed.
      if (contents !== previousContents) {
        fileVersions.set(fileName, previousVersion + 1);
        setFileContents(fileName, contents);
        projectMustUpdate = true;
      }
      if (projectMustUpdate) onProjectMustUpdate();
    };
    return { updateMemoryCache };
  }

  // Use full language services when the fast option is disabled.
  if (!transpileOnly) {
    const {
      readFile: cachedReadFile,
      fileExists: cachedFileExists,
      directoryExists,
      getDirectories,
      readDirectory,
      realpath,
      resolvePath,
      setFileContents,
      fileContents,
    } = createCachedFilesystem({ readFile, fileExists });
    const rootFileNames = new Set(config.fileNames);
    const fileVersions = new Map(
      Array.from(rootFileNames).map((fileName) => [fileName, 0])
    );

    // Use language services by default (TODO: invert next major version).
    if (!options.compilerHost) {
      let projectVersion = 1;

      const getCustomTransformers = () => {
        if (typeof transformers === 'function') {
          const program = service.getProgram();
          return program ? transformers(program) : undefined;
        }

        return transformers;
      };

      // Create the compiler host for type checking.
      const serviceHost: _ts.LanguageServiceHost &
        Required<Pick<_ts.LanguageServiceHost, 'fileExists' | 'readFile'>> = {
        getProjectVersion: () => String(projectVersion),
        getScriptFileNames: () => Array.from(rootFileNames),
        // Language service calls getScriptSnapshot, then getScriptVersion, in that order
        getScriptSnapshot(fileName: string) {
          debug('getScriptSnapshot', fileName);
          const contents = cachedReadFile(fileName);
          if (contents === undefined) return;
          return ts.ScriptSnapshot.fromString(contents);
        },
        getScriptVersion(fileName: string) {
          debug('getScriptVersion', fileName);
          let version = fileVersions.get(fileName);
          if(version === undefined) {
            version = 1;
            fileVersions.set(fileName, version);
          }
          return version.toString();
        },
        readFile: cachedReadFile,
        readDirectory,
        getDirectories,
        fileExists: cachedFileExists,
        directoryExists,
        realpath,
        getNewLine: () => ts.sys.newLine,
        useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
        getCurrentDirectory: () => cwd,
        getCompilationSettings: () => config.options,
        getDefaultLibFileName: () => ts.getDefaultLibFilePath(config.options),
        getCustomTransformers: getCustomTransformers,
      };
      const {
        resolveModuleNames,
        getResolvedModuleWithFailedLookupLocationsFromCache,
        resolveTypeReferenceDirectives,
        isFileKnownToBeInternal,
        markBucketOfFilenameInternal,
      } = createResolverFunctions({
        serviceHost,
        getCanonicalFileName,
        ts,
        cwd,
        config,
        configFilePath,
      });
      serviceHost.resolveModuleNames = resolveModuleNames;
      serviceHost.getResolvedModuleWithFailedLookupLocationsFromCache = getResolvedModuleWithFailedLookupLocationsFromCache;
      serviceHost.resolveTypeReferenceDirectives = resolveTypeReferenceDirectives;

      const registry = ts.createDocumentRegistry(
        ts.sys.useCaseSensitiveFileNames,
        cwd
      );
      const service = ts.createLanguageService(serviceHost, registry);

      const { updateMemoryCache } = createUpdateMemoryCacheFunction({
        rootFileNames,
        fileContents,
        setFileContents,
        fileVersions,
        isFileKnownToBeInternal,
        markBucketOfFilenameInternal,
        onProjectMustUpdate() {
          // Increment project version for every file change or addition to rootFileNames
          projectVersion++;
        },
      });

      let previousProgram: _ts.Program | undefined = undefined;

      getOutput = (code: string, fileName: string) => {
        updateMemoryCache(code, fileName);

        const programBefore = service.getProgram();
        if (programBefore !== previousProgram) {
          debug(
            `compiler rebuilt Program instance when getting output for ${fileName}`
          );
        }

        const output = service.getEmitOutput(fileName);

        // Get the relevant diagnostics - this is 3x faster than `getPreEmitDiagnostics`.
        const diagnostics = service
          .getSemanticDiagnostics(fileName)
          .concat(service.getSyntacticDiagnostics(fileName));

        const programAfter = service.getProgram();

        debug(
          'invariant: Is service.getProject() identical before and after getting emit output and diagnostics? (should always be true) ',
          programBefore === programAfter
        );

        previousProgram = programAfter;

        const diagnosticList = filterDiagnostics(
          diagnostics,
          ignoreDiagnostics
        );
        if (diagnosticList.length) reportTSError(diagnosticList);

        if (output.emitSkipped) {
          throw new TypeError(`${relative(cwd, fileName)}: Emit skipped`);
        }

        // Throw an error when requiring `.d.ts` files.
        if (output.outputFiles.length === 0) {
          throw new TypeError(
            `Unable to require file: ${relative(cwd, fileName)}\n` +
              'This is usually the result of a faulty configuration or import. ' +
              'Make sure there is a `.js`, `.json` or other executable extension with ' +
              'loader attached before `ts-node` available.'
          );
        }

        return [output.outputFiles[1].text, output.outputFiles[0].text];
      };

      getTypeInfo = (code: string, fileName: string, position: number) => {
        updateMemoryCache(code, fileName);

        const info = service.getQuickInfoAtPosition(fileName, position);
        const name = ts.displayPartsToString(info ? info.displayParts : []);
        const comment = ts.displayPartsToString(info ? info.documentation : []);

        return { name, comment };
      };
    } else {
      // options.compilerHost === true
      const sys: _ts.System & _ts.FormatDiagnosticsHost = {
        ...ts.sys,
        ...diagnosticHost,
        readFile: (fileName: string) => {
          const cacheContents = fileContents.get(fileName);
          if (cacheContents !== undefined) return cacheContents;
          const contents = cachedReadFile(fileName);
          if (contents) fileContents.set(fileName, contents);
          return contents;
        },
        readDirectory,
        getDirectories,
        fileExists: cachedFileExists,
        directoryExists,
        resolvePath,
        realpath,
      };

      const host: _ts.CompilerHost = ts.createIncrementalCompilerHost
        ? ts.createIncrementalCompilerHost(config.options, sys)
        : {
            ...sys,
            getSourceFile: (fileName, languageVersion) => {
              const contents = sys.readFile(fileName);
              if (contents === undefined) return;
              return ts.createSourceFile(fileName, contents, languageVersion);
            },
            getDefaultLibLocation: () => normalizeSlashes(dirname(compiler)),
            getDefaultLibFileName: () =>
              normalizeSlashes(
                join(
                  dirname(compiler),
                  ts.getDefaultLibFileName(config.options)
                )
              ),
            useCaseSensitiveFileNames: () => sys.useCaseSensitiveFileNames,
          };
      const {
        resolveModuleNames,
        resolveTypeReferenceDirectives,
        isFileKnownToBeInternal,
        markBucketOfFilenameInternal,
      } = createResolverFunctions({
        serviceHost: host,
        cwd,
        configFilePath,
        config,
        ts,
        getCanonicalFileName,
      });
      host.resolveModuleNames = resolveModuleNames;
      host.resolveTypeReferenceDirectives = resolveTypeReferenceDirectives;

      // Fallback for older TypeScript releases without incremental API.
      let builderProgram = ts.createIncrementalProgram
        ? ts.createIncrementalProgram({
            rootNames: Array.from(rootFileNames),
            options: config.options,
            host: host,
            configFileParsingDiagnostics: config.errors,
            projectReferences: config.projectReferences,
          })
        : ts.createEmitAndSemanticDiagnosticsBuilderProgram(
            Array.from(rootFileNames),
            config.options,
            host,
            undefined,
            config.errors,
            config.projectReferences
          );

      // Read and cache custom transformers.
      const customTransformers =
        typeof transformers === 'function'
          ? transformers(builderProgram.getProgram())
          : transformers;

      // Set the file contents into cache manually.
      const { updateMemoryCache } = createUpdateMemoryCacheFunction({
        rootFileNames,
        fileVersions,
        fileContents,
        setFileContents,
        isFileKnownToBeInternal,
        markBucketOfFilenameInternal,
        onProjectMustUpdate() {
          // Update program when file changes.
          builderProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
            Array.from(rootFileNames),
            config.options,
            host,
            builderProgram,
            config.errors,
            config.projectReferences
          );
        },
      });

      getOutput = (code: string, fileName: string) => {
        const output: [string, string] = ['', ''];

        updateMemoryCache(code, fileName);

        const sourceFile = builderProgram.getSourceFile(fileName);
        if (!sourceFile)
          throw new TypeError(`Unable to read file: ${fileName}`);

        const program = builderProgram.getProgram();
        const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile);
        const diagnosticList = filterDiagnostics(
          diagnostics,
          ignoreDiagnostics
        );
        if (diagnosticList.length) reportTSError(diagnosticList);

        const result = builderProgram.emit(
          sourceFile,
          (path, file, writeByteOrderMark) => {
            if (path.endsWith('.map')) {
              output[1] = file;
            } else {
              output[0] = file;
            }

            if (options.emit) sys.writeFile(path, file, writeByteOrderMark);
          },
          undefined,
          undefined,
          customTransformers
        );

        if (result.emitSkipped) {
          throw new TypeError(`${relative(cwd, fileName)}: Emit skipped`);
        }

        // Throw an error when requiring files that cannot be compiled.
        if (output[0] === '') {
          if (program.isSourceFileFromExternalLibrary(sourceFile)) {
            throw new TypeError(
              `Unable to compile file from external library: ${relative(
                cwd,
                fileName
              )}`
            );
          }

          throw new TypeError(
            `Unable to require file: ${relative(cwd, fileName)}\n` +
              'This is usually the result of a faulty configuration or import. ' +
              'Make sure there is a `.js`, `.json` or other executable extension with ' +
              'loader attached before `ts-node` available.'
          );
        }

        return output;
      };

      getTypeInfo = (code: string, fileName: string, position: number) => {
        updateMemoryCache(code, fileName);

        const sourceFile = builderProgram.getSourceFile(fileName);
        if (!sourceFile)
          throw new TypeError(`Unable to read file: ${fileName}`);

        const node = getTokenAtPosition(ts, sourceFile, position);
        const checker = builderProgram.getProgram().getTypeChecker();
        const symbol = checker.getSymbolAtLocation(node);

        if (!symbol) return { name: '', comment: '' };

        const type = checker.getTypeOfSymbolAtLocation(symbol, node);
        const signatures = [
          ...type.getConstructSignatures(),
          ...type.getCallSignatures(),
        ];

        return {
          name: signatures.length
            ? signatures.map((x) => checker.signatureToString(x)).join('\n')
            : checker.typeToString(type),
          comment: ts.displayPartsToString(
            symbol ? symbol.getDocumentationComment(checker) : []
          ),
        };
      };

      // Write `.tsbuildinfo` when `--build` is enabled.
      if (options.emit && config.options.incremental) {
        process.on('exit', () => {
          // Emits `.tsbuildinfo` to filesystem.
          (builderProgram.getProgram() as any).emitBuildInfo();
        });
      }
    }
  } else {
    getOutput = createTranspileOnlyGetOutputFunction();

    getTypeInfo = () => {
      throw new TypeError(
        'Type information is unavailable in "--transpile-only"'
      );
    };
  }

  function createTranspileOnlyGetOutputFunction(
    overrideModuleType?: _ts.ModuleKind
  ): GetOutputFunction {
    const compilerOptions = { ...config.options };
    if (overrideModuleType !== undefined)
      compilerOptions.module = overrideModuleType;
    return (code: string, fileName: string): SourceOutput => {
      let result: _ts.TranspileOutput;
      if (customTranspiler) {
        result = customTranspiler.transpile(code, {
          fileName,
        });
      } else {
        result = ts.transpileModule(code, {
          fileName,
          compilerOptions,
          reportDiagnostics: true,
          transformers: transformers as _ts.CustomTransformers | undefined,
        });
      }

      const diagnosticList = filterDiagnostics(
        result.diagnostics || [],
        ignoreDiagnostics
      );
      if (diagnosticList.length) reportTSError(diagnosticList);

      return [result.outputText, result.sourceMapText as string];
    };
  }

  // When either is undefined, it means normal `getOutput` should be used
  const getOutputForceCommonJS =
    config.options.module === ts.ModuleKind.CommonJS
      ? undefined
      : createTranspileOnlyGetOutputFunction(ts.ModuleKind.CommonJS);
  const getOutputForceESM =
    config.options.module === ts.ModuleKind.ES2015 ||
    config.options.module === ts.ModuleKind.ES2020 ||
    config.options.module === ts.ModuleKind.ESNext
      ? undefined
      : createTranspileOnlyGetOutputFunction(
          ts.ModuleKind.ES2020 || ts.ModuleKind.ES2015
        );

  // Create a simple TypeScript compiler proxy.
  function compile(code: string, fileName: string, lineOffset = 0) {
    const normalizedFileName = normalizeSlashes(fileName);
    const classification = moduleTypeClassifier.classifyModule(
      normalizedFileName
    );
    // Must always call normal getOutput to throw typechecking errors
    let [value, sourceMap] = getOutput(code, normalizedFileName);
    // If module classification contradicts the above, call the relevant transpiler
    if (classification.moduleType === 'cjs' && getOutputForceCommonJS) {
      [value, sourceMap] = getOutputForceCommonJS(code, normalizedFileName);
    } else if (classification.moduleType === 'esm' && getOutputForceESM) {
      [value, sourceMap] = getOutputForceESM(code, normalizedFileName);
    }
    const output = updateOutput(
      value,
      normalizedFileName,
      sourceMap,
      getExtension
    );
    outputCache.set(normalizedFileName, { content: output });
    return output;
  }

  let active = true;
  const enabled = (enabled?: boolean) =>
    enabled === undefined ? active : (active = !!enabled);
  const extensions = getExtensions(config);
  const ignored = (fileName: string) => {
    if (!active) return true;
    const ext = extname(fileName);
    if (
      extensions.tsExtensions.includes(ext) ||
      extensions.jsExtensions.includes(ext)
    ) {
      return !isScoped(fileName) || shouldIgnore(fileName);
    }
    return true;
  };

  return {
    ts,
    config,
    compile,
    getTypeInfo,
    ignored,
    enabled,
    options,
    configFilePath,
    moduleTypeClassifier,
  };
}

/**
 * Check if the filename should be ignored.
 */
function createIgnore(ignoreBaseDir: string, ignore: RegExp[]) {
  return (fileName: string) => {
    const relname = relative(ignoreBaseDir, fileName);
    const path = normalizeSlashes(relname);

    return ignore.some((x) => x.test(path));
  };
}

/**
 * "Refreshes" an extension on `require.extensions`.
 *
 * @param {string} ext
 */
function reorderRequireExtension(ext: string) {
  const old = require.extensions[ext];
  delete require.extensions[ext];
  require.extensions[ext] = old;
}

/**
 * Register the extensions to support when importing files.
 */
function registerExtensions(
  preferTsExts: boolean | null | undefined,
  extensions: string[],
  service: Service,
  originalJsHandler: (m: NodeModule, filename: string) => any
) {
  // Register new extensions.
  for (const ext of extensions) {
    registerExtension(ext, service, originalJsHandler);
  }

  if (preferTsExts) {
    const preferredExtensions = new Set([
      ...extensions,
      ...Object.keys(require.extensions),
    ]);

    for (const ext of preferredExtensions) reorderRequireExtension(ext);
  }
}

/**
 * Register the extension for node.
 */
function registerExtension(
  ext: string,
  service: Service,
  originalHandler: (m: NodeModule, filename: string) => any
) {
  const old = require.extensions[ext] || originalHandler;

  require.extensions[ext] = function (m: any, filename) {
    if (service.ignored(filename)) return old(m, filename);

    assertScriptCanLoadAsCJS(service, m, filename);

    const _compile = m._compile;

    m._compile = function (code: string, fileName: string) {
      debug('module._compile', fileName);

      const result = service.compile(code, fileName);
      return _compile.call(this, result, fileName);
    };

    return old(m, filename);
  };
}

/**
 * Internal source output.
 */
type SourceOutput = [string, string];

/**
 * Update the output remapping the source map.
 */
function updateOutput(
  outputText: string,
  fileName: string,
  sourceMap: string,
  getExtension: (fileName: string) => string
) {
  const base64Map = Buffer.from(
    updateSourceMap(sourceMap, fileName),
    'utf8'
  ).toString('base64');
  const sourceMapContent = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64Map}`;
  // Expected form: `//# sourceMappingURL=foo bar.js.map` or `//# sourceMappingURL=foo%20bar.js.map` for input file "foo bar.tsx"
  // Percent-encoding behavior added in TS 4.1.1: https://github.com/microsoft/TypeScript/issues/40951
  const prefix = '//# sourceMappingURL=';
  const prefixLength = prefix.length;
  const baseName = /*foo.tsx*/ basename(fileName);
  const extName = /*.tsx*/ extname(fileName);
  const extension = /*.js*/ getExtension(fileName);
  const sourcemapFilename =
    baseName.slice(0, -extName.length) + extension + '.map';
  const sourceMapLengthWithoutPercentEncoding =
    prefixLength + sourcemapFilename.length;
  /*
   * Only rewrite if existing directive exists at the location we expect, to support:
   *   a) compilers that do not append a sourcemap directive
   *   b) situations where we did the math wrong
   *     Not ideal, but appending our sourcemap *after* a pre-existing sourcemap still overrides, so the end-user is happy.
   */
  if (
    outputText.substr(-sourceMapLengthWithoutPercentEncoding, prefixLength) ===
    prefix
  ) {
    return (
      outputText.slice(0, -sourceMapLengthWithoutPercentEncoding) +
      sourceMapContent
    );
  }
  // If anyone asks why we're not using URL, the URL equivalent is: `u = new URL('http://d'); u.pathname = "/" + sourcemapFilename; return u.pathname.slice(1);
  const sourceMapLengthWithPercentEncoding =
    prefixLength + encodeURI(sourcemapFilename).length;
  if (
    outputText.substr(-sourceMapLengthWithPercentEncoding, prefixLength) ===
    prefix
  ) {
    return (
      outputText.slice(0, -sourceMapLengthWithPercentEncoding) +
      sourceMapContent
    );
  }

  return `${outputText}\n${sourceMapContent}`;
}

/**
 * Update the source map contents for improved output.
 */
function updateSourceMap(sourceMapText: string, fileName: string) {
  const sourceMap = JSON.parse(sourceMapText);
  sourceMap.file = fileName;
  sourceMap.sources = [fileName];
  delete sourceMap.sourceRoot;
  return JSON.stringify(sourceMap);
}

/**
 * Filter diagnostics.
 */
function filterDiagnostics(
  diagnostics: readonly _ts.Diagnostic[],
  ignore: number[]
) {
  return diagnostics.filter((x) => ignore.indexOf(x.code) === -1);
}

/**
 * Get token at file position.
 *
 * Reference: https://github.com/microsoft/TypeScript/blob/fcd9334f57d85b73dd66ad2d21c02e84822f4841/src/services/utilities.ts#L705-L731
 */
function getTokenAtPosition(
  ts: TSCommon,
  sourceFile: _ts.SourceFile,
  position: number
): _ts.Node {
  let current: _ts.Node = sourceFile;

  outer: while (true) {
    for (const child of current.getChildren(sourceFile)) {
      const start = child.getFullStart();
      if (start > position) break;

      const end = child.getEnd();
      if (position <= end) {
        current = child;
        continue outer;
      }
    }

    return current;
  }
}
