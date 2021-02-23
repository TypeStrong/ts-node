import { test } from './testlib'
import { relative, basename, extname, resolve, dirname, join } from 'path'
import sourceMapSupport = require('source-map-support')
import * as ynModule from 'yn'
import { BaseError } from 'make-error'
import * as util from 'util'
import { fileURLToPath } from 'url'
import type * as _ts from 'typescript'
import { Module, createRequire as nodeCreateRequire, createRequireFromPath as nodeCreateRequireFromPath } from 'module'
import type _createRequire from 'create-require'
import { getDefaultTsconfigJsonForNodeVersion } from './tsconfigs'
// tslint:disable-next-line:deprecation
export const createRequire = nodeCreateRequire ?? nodeCreateRequireFromPath ?? require('create-require') as typeof _createRequire

export { createRepl, CreateReplOptions, ReplService } from './repl'

/**
 * Does this version of node obey the package.json "type" field
 * and throw ERR_REQUIRE_ESM when attempting to require() an ESM modules.
 */
const engineSupportsPackageTypeField = parseInt(process.versions.node.split('.')[0], 10) >= 12

/**
 * Assert that script can be loaded as CommonJS when we attempt to require it.
 * If it should be loaded as ESM, throw ERR_REQUIRE_ESM like node does.
 *
 * Loaded conditionally so we don't need to support older node versions
 */
const assertScriptCanLoadAsCJS: (filename: string) => void =
  engineSupportsPackageTypeField
  ? require('../dist-raw/node-cjs-loader-utils').assertScriptCanLoadAsCJSImpl
  : () => {/* noop */}

/**
 * Registered `ts-node` instance information.
 */
export const REGISTER_INSTANCE = Symbol.for('ts-node.register.instance')

/**
 * Expose `REGISTER_INSTANCE` information on node.js `process`.
 */
declare global {
  namespace NodeJS {
    interface Process {
      [REGISTER_INSTANCE]?: Service
    }
  }
}

/** @internal */
export const env = process.env as ProcessEnv
/**
 * Declare all env vars, to aid discoverability.
 * If an env var affects ts-node's behavior, it should not be buried somewhere in our codebase.
 * @internal
 */
export interface ProcessEnv {
  TS_NODE_DEBUG?: string
  TS_NODE_CWD?: string
  /** @deprecated */
  TS_NODE_DIR?: string
  TS_NODE_EMIT?: string
  /** @deprecated */
  TS_NODE_SCOPE?: string
  TS_NODE_FILES?: string
  TS_NODE_PRETTY?: string
  TS_NODE_COMPILER?: string
  TS_NODE_COMPILER_OPTIONS?: string
  TS_NODE_IGNORE?: string
  TS_NODE_PROJECT?: string
  TS_NODE_SKIP_PROJECT?: string
  TS_NODE_SKIP_IGNORE?: string
  TS_NODE_PREFER_TS_EXTS?: string
  TS_NODE_IGNORE_DIAGNOSTICS?: string
  TS_NODE_TRANSPILE_ONLY?: string
  TS_NODE_TYPE_CHECK?: string
  TS_NODE_COMPILER_HOST?: string
  TS_NODE_LOG_ERROR?: string
  TS_NODE_HISTORY?: string

  NODE_NO_READLINE?: string
}

/**
 * @internal
 */
export const INSPECT_CUSTOM = util.inspect.custom || 'inspect'

/**
 * Wrapper around yn module that returns `undefined` instead of `null`.
 * This is implemented by yn v4, but we're staying on v3 to avoid v4's node 10 requirement.
 */
function yn (value: string | undefined) {
  return ynModule(value) ?? undefined
}

/**
 * Debugging `ts-node`.
 */
const shouldDebug = yn(env.TS_NODE_DEBUG)
/** @internal */
export const debug = shouldDebug ?
  (...args: any) => console.log(`[ts-node ${new Date().toISOString()}]`, ...args)
  : () => undefined
const debugFn = shouldDebug ?
  <T, U>(key: string, fn: (arg: T) => U) => {
    let i = 0
    return (x: T) => {
      debug(key, x, ++i)
      return fn(x)
    }
  } :
  <T, U>(_: string, fn: (arg: T) => U) => fn

/**
 * Common TypeScript interfaces between versions.
 */
export interface TSCommon {
  version: typeof _ts.version
  sys: typeof _ts.sys
  ScriptSnapshot: typeof _ts.ScriptSnapshot
  displayPartsToString: typeof _ts.displayPartsToString
  createLanguageService: typeof _ts.createLanguageService
  getDefaultLibFilePath: typeof _ts.getDefaultLibFilePath
  getPreEmitDiagnostics: typeof _ts.getPreEmitDiagnostics
  flattenDiagnosticMessageText: typeof _ts.flattenDiagnosticMessageText
  transpileModule: typeof _ts.transpileModule
  ModuleKind: typeof _ts.ModuleKind
  ScriptTarget: typeof _ts.ScriptTarget
  findConfigFile: typeof _ts.findConfigFile
  readConfigFile: typeof _ts.readConfigFile
  parseJsonConfigFileContent: typeof _ts.parseJsonConfigFileContent
  formatDiagnostics: typeof _ts.formatDiagnostics
  formatDiagnosticsWithColorAndContext: typeof _ts.formatDiagnosticsWithColorAndContext
}

/**
 * Compiler APIs we use that are marked internal and not included in TypeScript's public API declarations
 */
interface TSInternal {
  // https://github.com/microsoft/TypeScript/blob/4a34294908bed6701dcba2456ca7ac5eafe0ddff/src/compiler/core.ts#L1906-L1909
  createGetCanonicalFileName (useCaseSensitiveFileNames: boolean): TSInternal.GetCanonicalFileName
}
namespace TSInternal {
  // https://github.com/microsoft/TypeScript/blob/4a34294908bed6701dcba2456ca7ac5eafe0ddff/src/compiler/core.ts#L1906
  export type GetCanonicalFileName = (fileName: string) => string
}

/**
 * Export the current version.
 */
export const VERSION = require('../package.json').version

/**
 * Options for creating a new TypeScript compiler instance.
 */
export interface CreateOptions {
  /**
   * Behave as if invoked within this working directory.  Roughly equivalent to `cd $dir && ts-node ...`
   *
   * @default process.cwd()
   */
  cwd?: string
  /**
   * Legacy alias for `cwd`
   *
   * @deprecated use `projectSearchDir` or `cwd`
   */
  dir?: string
  /**
   * Emit output files into `.ts-node` directory.
   *
   * @default false
   */
  emit?: boolean
  /**
   * Scope compiler to files within `scopeDir`.
   *
   * @default false
   */
  scope?: boolean
  /**
   * @default First of: `tsconfig.json` "rootDir" if specified, directory containing `tsconfig.json`, or cwd if no `tsconfig.json` is loaded.
   */
  scopeDir?: string
  /**
   * Use pretty diagnostic formatter.
   *
   * @default false
   */
  pretty?: boolean
  /**
   * Use TypeScript's faster `transpileModule`.
   *
   * @default false
   */
  transpileOnly?: boolean
  /**
   * **DEPRECATED** Specify type-check is enabled (e.g. `transpileOnly == false`).
   *
   * @default true
   */
  typeCheck?: boolean
  /**
   * Use TypeScript's compiler host API instead of the language service API.
   *
   * @default false
   */
  compilerHost?: boolean
  /**
   * Logs TypeScript errors to stderr instead of throwing exceptions.
   *
   * @default false
   */
  logError?: boolean
  /**
   * Load "files" and "include" from `tsconfig.json` on startup.
   *
   * Default is to override `tsconfig.json` "files" and "include" to only include the entrypoint script.
   *
   * @default false
   */
  files?: boolean
  /**
   * Specify a custom TypeScript compiler.
   *
   * @default "typescript"
   */
  compiler?: string
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
  ignore?: string[]
  /**
   * Path to TypeScript config file or directory containing a `tsconfig.json`.
   * Similar to the `tsc --project` flag: https://www.typescriptlang.org/docs/handbook/compiler-options.html
   */
  project?: string
  /**
   * Search for TypeScript config file (`tsconfig.json`) in this or parent directories.
   */
  projectSearchDir?: string
  /**
   * Skip project config resolution and loading.
   *
   * @default false
   */
  skipProject?: boolean
  /**
   * Skip loading a default @tsconfig/* that matches the version of nodejs
   * TODO needs a better name
   *
   * @default false
   */
  skipDefaultCompilerOptions?: boolean
  /**
   * Skip ignore check, so that compilation will be attempted for all files with matching extensions.
   *
   * @default false
   */
  skipIgnore?: boolean
  /**
   * JSON object to merge with TypeScript `compilerOptions`.
   *
   * @allOf [{"$ref": "https://schemastore.azurewebsites.net/schemas/json/tsconfig.json#definitions/compilerOptionsDefinition/properties/compilerOptions"}]
   */
  compilerOptions?: object
  /**
   * Ignore TypeScript warnings by diagnostic code.
   */
  ignoreDiagnostics?: Array<number | string>
  /**
   * Modules to require, like node's `--require` flag.
   *
   * If specified in `tsconfig.json`, the modules will be resolved relative to the `tsconfig.json` file.
   *
   * If specified programmatically, each input string should be pre-resolved to an absolute path for
   * best results.
   */
  require?: Array<string>
  readFile?: (path: string) => string | undefined
  fileExists?: (path: string) => boolean
  transformers?: _ts.CustomTransformers | ((p: _ts.Program) => _ts.CustomTransformers)
  /**
   * True if require() hooks should interop with experimental ESM loader.
   * Enabled explicitly via a flag since it is a breaking change.
   * @internal
   */
  experimentalEsmLoader?: boolean
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
  preferTsExts?: boolean
}

/**
 * Must be an interface to support `typescript-json-schema`.
 */
export interface TsConfigOptions extends Omit<RegisterOptions,
  | 'transformers'
  | 'readFile'
  | 'fileExists'
  | 'skipProject'
  | 'project'
  | 'dir'
  | 'cwd'
  | 'projectSearchDir'
  | 'scope'
  | 'scopeDir'
  | 'experimentalEsmLoader'
  | 'skipDefaultCompilerOptions'
  > {}

/**
 * Like `Object.assign`, but ignores `undefined` properties.
 */
function assign<T extends object> (initialValue: T, ...sources: Array<T>): T {
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      const value = (source as any)[key]
      if (value !== undefined) (initialValue as any)[key] = value
    }
  }
  return initialValue
}

/**
 * Information retrieved from type info check.
 */
export interface TypeInfo {
  name: string
  comment: string
}

/**
 * Default register options, including values specified via environment
 * variables.
 */
export const DEFAULTS: RegisterOptions = {
  cwd: env.TS_NODE_CWD ?? env.TS_NODE_DIR, // tslint:disable-line:deprecation
  emit: yn(env.TS_NODE_EMIT),
  scope: yn(env.TS_NODE_SCOPE), // tslint:disable-line:deprecation
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
  skipDefaultCompilerOptions: false
}

/**
 * TypeScript compiler option values required by `ts-node` which cannot be overridden.
 */
const TS_NODE_COMPILER_OPTIONS = {
  sourceMap: true,
  inlineSourceMap: false,
  inlineSources: true,
  declaration: false,
  noEmit: false,
  outDir: '.ts-node'
}

/**
 * Split a string array of values.
 * @internal
 */
export function split (value: string | undefined) {
  return typeof value === 'string' ? value.split(/ *, */g) : undefined
}

/**
 * Parse a string as JSON.
 * @internal
 */
export function parse (value: string | undefined): object | undefined {
  return typeof value === 'string' ? JSON.parse(value) : undefined
}

/**
 * Replace backslashes with forward slashes.
 * @internal
 */
export function normalizeSlashes (value: string): string {
  return value.replace(/\\/g, '/')
}

/**
 * TypeScript diagnostics error.
 */
export class TSError extends BaseError {
  name = 'TSError'

  constructor (public diagnosticText: string, public diagnosticCodes: number[]) {
    super(`⨯ Unable to compile TypeScript:\n${diagnosticText}`)
  }

  /**
   * @internal
   */
  [INSPECT_CUSTOM] () {
    return this.diagnosticText
  }
}

/**
 * Primary ts-node service, which wraps the TypeScript API and can compile TypeScript to JavaScript
 */
export interface Service {
  ts: TSCommon
  config: _ts.ParsedCommandLine
  options: RegisterOptions
  enabled (enabled?: boolean): boolean
  ignored (fileName: string): boolean
  compile (code: string, fileName: string, lineOffset?: number): string
  getTypeInfo (code: string, fileName: string, position: number): TypeInfo
}

/**
 * Re-export of `Service` interface for backwards-compatibility
 * @deprecated use `Service` instead
 * @see Service
 */
export type Register = Service

/**
 * Cached fs operation wrapper.
 */
function cachedLookup<T> (fn: (arg: string) => T): (arg: string) => T {
  const cache = new Map<string, T>()

  return (arg: string): T => {
    if (!cache.has(arg)) {
      cache.set(arg, fn(arg))
    }

    return cache.get(arg)!
  }
}

/** @internal */
export function getExtensions (config: _ts.ParsedCommandLine) {
  const tsExtensions = ['.ts']
  const jsExtensions = []

  // Enable additional extensions when JSX or `allowJs` is enabled.
  if (config.options.jsx) tsExtensions.push('.tsx')
  if (config.options.allowJs) jsExtensions.push('.js')
  if (config.options.jsx && config.options.allowJs) jsExtensions.push('.jsx')
  return { tsExtensions, jsExtensions }
}

/**
 * Register TypeScript compiler instance onto node.js
 */
export function register (opts: RegisterOptions = {}): Service {
  const originalJsHandler = require.extensions['.js'] // tslint:disable-line
  const service = create(opts)
  const { tsExtensions, jsExtensions } = getExtensions(service.config)
  const extensions = [...tsExtensions, ...jsExtensions]

  // Expose registered instance globally.
  process[REGISTER_INSTANCE] = service

  // Register the extensions.
  registerExtensions(service.options.preferTsExts, extensions, service, originalJsHandler)

  // Require specified modules before start-up.
  ;(Module as any)._preloadModules(service.options.require)

  return service
}

/**
 * Create TypeScript compiler instance.
 */
export function create (rawOptions: CreateOptions = {}): Service {
  const cwd = resolve(rawOptions.cwd ?? rawOptions.dir ?? DEFAULTS.cwd ?? process.cwd()) // tslint:disable-line:deprecation
  const compilerName = rawOptions.compiler ?? DEFAULTS.compiler

  /**
   * Load the typescript compiler. It is required to load the tsconfig but might
   * be changed by the tsconfig, so we have to do this twice.
   */
  function loadCompiler (name: string | undefined, relativeToPath: string) {
    const compiler = require.resolve(name || 'typescript', { paths: [relativeToPath, __dirname] })
    const ts: typeof _ts = require(compiler)
    return { compiler, ts }
  }

  // Compute minimum options to read the config file.
  let { compiler, ts } = loadCompiler(compilerName, rawOptions.projectSearchDir ?? rawOptions.project ?? cwd)

  // Read config file and merge new options between env and CLI options.
  const { configFilePath, config, tsNodeOptionsFromTsconfig } = readConfig(cwd, ts, rawOptions)
  const options = assign<RegisterOptions>({}, DEFAULTS, tsNodeOptionsFromTsconfig || {}, rawOptions)
  options.require = [
    ...tsNodeOptionsFromTsconfig.require || [],
    ...rawOptions.require || []
  ]

  // Re-load the compiler in case it has changed.
  // Compiler is loaded relative to tsconfig.json, so tsconfig discovery may cause us to load a
  // different compiler than we did above, even if the name has not changed.
  if (configFilePath) {
    ({ compiler, ts } = loadCompiler(options.compiler, configFilePath))
  }

  const readFile = options.readFile || ts.sys.readFile
  const fileExists = options.fileExists || ts.sys.fileExists
  // typeCheck can override transpileOnly, useful for CLI flag to override config file
  const transpileOnly = options.transpileOnly === true && options.typeCheck !== true
  const transformers = options.transformers || undefined
  const ignoreDiagnostics = [
    6059, // "'rootDir' is expected to contain all source files."
    18002, // "The 'files' list in config file is empty."
    18003, // "No inputs were found in config file."
    ...(options.ignoreDiagnostics || [])
  ].map(Number)

  const configDiagnosticList = filterDiagnostics(config.errors, ignoreDiagnostics)
  const outputCache = new Map<string, {
    content: string
  }>()

  const configFileDirname = configFilePath ? dirname(configFilePath) : null
  const scopeDir = options.scopeDir ?? config.options.rootDir ?? configFileDirname ?? cwd
  const ignoreBaseDir = configFileDirname ?? cwd
  const isScoped = options.scope ? (fileName: string) => relative(scopeDir, fileName).charAt(0) !== '.' : () => true
  const shouldIgnore = createIgnore(ignoreBaseDir, options.skipIgnore ? [] : (
    options.ignore || ['(?:^|/)node_modules/']
  ).map(str => new RegExp(str)))

  const diagnosticHost: _ts.FormatDiagnosticsHost = {
    getNewLine: () => ts.sys.newLine,
    getCurrentDirectory: () => cwd,
    getCanonicalFileName: ts.sys.useCaseSensitiveFileNames ? x => x : x => x.toLowerCase()
  }

  // Install source map support and read from memory cache.
  sourceMapSupport.install({
    environment: 'node',
    retrieveFile (pathOrUrl: string) {
      let path = pathOrUrl
      // If it's a file URL, convert to local path
      // Note: fileURLToPath does not exist on early node v10
      // I could not find a way to handle non-URLs except to swallow an error
      if (options.experimentalEsmLoader && path.startsWith('file://')) {
        try {
          path = fileURLToPath(path)
        } catch (e) {/* swallow error */}
      }
      path = normalizeSlashes(path)
      return outputCache.get(path)?.content || ''
    }
  })

  const formatDiagnostics = process.stdout.isTTY || options.pretty
    ? (ts.formatDiagnosticsWithColorAndContext || ts.formatDiagnostics)
    : ts.formatDiagnostics

  function createTSError (diagnostics: ReadonlyArray<_ts.Diagnostic>) {
    const diagnosticText = formatDiagnostics(diagnostics, diagnosticHost)
    const diagnosticCodes = diagnostics.map(x => x.code)
    return new TSError(diagnosticText, diagnosticCodes)
  }

  function reportTSError (configDiagnosticList: _ts.Diagnostic[]) {
    const error = createTSError(configDiagnosticList)
    if (options.logError) {
      // Print error in red color and continue execution.
      console.error('\x1b[31m%s\x1b[0m', error)
    } else {
      // Throw error and exit the script.
      throw error
    }
  }

  // Render the configuration errors.
  if (configDiagnosticList.length) reportTSError(configDiagnosticList)

  /**
   * Get the extension for a transpiled file.
   */
  const getExtension = config.options.jsx === ts.JsxEmit.Preserve ?
    ((path: string) => /\.[tj]sx$/.test(path) ? '.jsx' : '.js') :
    ((_: string) => '.js')

  /**
   * Create the basic required function using transpile mode.
   */
  let getOutput: (code: string, fileName: string) => SourceOutput
  let getTypeInfo: (_code: string, _fileName: string, _position: number) => TypeInfo

  const getCanonicalFileName = (ts as unknown as TSInternal).createGetCanonicalFileName(ts.sys.useCaseSensitiveFileNames)

  // In a factory because these are shared across both CompilerHost and LanguageService codepaths
  function createResolverFunctions (serviceHost: _ts.ModuleResolutionHost) {
    const moduleResolutionCache = ts.createModuleResolutionCache(cwd, getCanonicalFileName, config.options)
    const knownInternalFilenames = new Set<string>()
    /** "Buckets" (module directories) whose contents should be marked "internal" */
    const internalBuckets = new Set<string>()

    // Get bucket for a source filename.  Bucket is the containing `./node_modules/*/` directory
    // For '/project/node_modules/foo/node_modules/bar/lib/index.js' bucket is '/project/node_modules/foo/node_modules/bar/'
    // For '/project/node_modules/foo/node_modules/@scope/bar/lib/index.js' bucket is '/project/node_modules/foo/node_modules/@scope/bar/'
    const moduleBucketRe = /.*\/node_modules\/(?:@[^\/]+\/)?[^\/]+\//
    function getModuleBucket (filename: string) {
      const find = moduleBucketRe.exec(filename)
      if (find) return find[0]
      return ''
    }

    // Mark that this file and all siblings in its bucket should be "internal"
    function markBucketOfFilenameInternal (filename: string) {
      internalBuckets.add(getModuleBucket(filename))
    }

    function isFileInInternalBucket (filename: string) {
      return internalBuckets.has(getModuleBucket(filename))
    }

    function isFileKnownToBeInternal (filename: string) {
      return knownInternalFilenames.has(filename)
    }

    /**
     * If we need to emit JS for a file, force TS to consider it non-external
     */
    const fixupResolvedModule = (resolvedModule: _ts.ResolvedModule | _ts.ResolvedTypeReferenceDirective) => {
      const { resolvedFileName } = resolvedModule
      if (resolvedFileName === undefined) return
      // .ts is always switched to internal
      // .js is switched on-demand
      if (
        resolvedModule.isExternalLibraryImport && (
          (resolvedFileName.endsWith('.ts') && !resolvedFileName.endsWith('.d.ts')) ||
          isFileKnownToBeInternal(resolvedFileName) ||
          isFileInInternalBucket(resolvedFileName)
        )
      ) {
        resolvedModule.isExternalLibraryImport = false
      }
      if (!resolvedModule.isExternalLibraryImport) {
        knownInternalFilenames.add(resolvedFileName)
      }
    }
    /*
     * NOTE:
     * Older ts versions do not pass `redirectedReference` nor `options`.
     * We must pass `redirectedReference` to newer ts versions, but cannot rely on `options`, hence the weird argument name
     */
    const resolveModuleNames: _ts.LanguageServiceHost['resolveModuleNames'] = (moduleNames: string[], containingFile: string, reusedNames: string[] | undefined, redirectedReference: _ts.ResolvedProjectReference | undefined, optionsOnlyWithNewerTsVersions: _ts.CompilerOptions): (_ts.ResolvedModule | undefined)[] => {
      return moduleNames.map(moduleName => {
        const { resolvedModule } = ts.resolveModuleName(moduleName, containingFile, config.options, serviceHost, moduleResolutionCache, redirectedReference)
        if (resolvedModule) {
          fixupResolvedModule(resolvedModule)
        }
        return resolvedModule
      })
    }

    // language service never calls this, but TS docs recommend that we implement it
    const getResolvedModuleWithFailedLookupLocationsFromCache: _ts.LanguageServiceHost['getResolvedModuleWithFailedLookupLocationsFromCache'] = (moduleName, containingFile): _ts.ResolvedModuleWithFailedLookupLocations | undefined => {
      const ret = ts.resolveModuleNameFromCache(moduleName, containingFile, moduleResolutionCache)
      if (ret && ret.resolvedModule) {
        fixupResolvedModule(ret.resolvedModule)
      }
      return ret
    }

    const resolveTypeReferenceDirectives: _ts.LanguageServiceHost['resolveTypeReferenceDirectives'] = (typeDirectiveNames: string[], containingFile: string, redirectedReference: _ts.ResolvedProjectReference | undefined, options: _ts.CompilerOptions): (_ts.ResolvedTypeReferenceDirective | undefined)[] => {
      // Note: seems to be called with empty typeDirectiveNames array for all files.
      return typeDirectiveNames.map(typeDirectiveName => {
        const { resolvedTypeReferenceDirective } = ts.resolveTypeReferenceDirective(typeDirectiveName, containingFile, config.options, serviceHost, redirectedReference)
        if (resolvedTypeReferenceDirective) {
          fixupResolvedModule(resolvedTypeReferenceDirective)
        }
        return resolvedTypeReferenceDirective
      })
    }

    return {
      resolveModuleNames,
      getResolvedModuleWithFailedLookupLocationsFromCache,
      resolveTypeReferenceDirectives,
      isFileKnownToBeInternal,
      markBucketOfFilenameInternal
    }
  }

  // Use full language services when the fast option is disabled.
  if (!transpileOnly) {
    const fileContents = new Map<string, string>()
    const rootFileNames = new Set(config.fileNames)
    const cachedReadFile = cachedLookup(debugFn('readFile', readFile))

    // Use language services by default (TODO: invert next major version).
    if (!options.compilerHost) {
      let projectVersion = 1
      const fileVersions = new Map(Array.from(rootFileNames).map(fileName => [fileName, 0]))

      const getCustomTransformers = () => {
        if (typeof transformers === 'function') {
          const program = service.getProgram()
          return program ? transformers(program) : undefined
        }

        return transformers
      }

      // Create the compiler host for type checking.
      const serviceHost: _ts.LanguageServiceHost & Required<Pick<_ts.LanguageServiceHost, 'fileExists' | 'readFile'>> = {
        getProjectVersion: () => String(projectVersion),
        getScriptFileNames: () => Array.from(rootFileNames),
        getScriptVersion: (fileName: string) => {
          const version = fileVersions.get(fileName)
          return version ? version.toString() : ''
        },
        getScriptSnapshot (fileName: string) {
          // TODO ordering of this with getScriptVersion?  Should they sync up?
          let contents = fileContents.get(fileName)

          // Read contents into TypeScript memory cache.
          if (contents === undefined) {
            contents = cachedReadFile(fileName)
            if (contents === undefined) return

            fileVersions.set(fileName, 1)
            fileContents.set(fileName, contents)
            projectVersion++
          }

          return ts.ScriptSnapshot.fromString(contents)
        },
        readFile: cachedReadFile,
        readDirectory: ts.sys.readDirectory,
        getDirectories: cachedLookup(debugFn('getDirectories', ts.sys.getDirectories)),
        fileExists: cachedLookup(debugFn('fileExists', fileExists)),
        directoryExists: cachedLookup(debugFn('directoryExists', ts.sys.directoryExists)),
        realpath: ts.sys.realpath ? cachedLookup(debugFn('realpath', ts.sys.realpath)) : undefined,
        getNewLine: () => ts.sys.newLine,
        useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
        getCurrentDirectory: () => cwd,
        getCompilationSettings: () => config.options,
        getDefaultLibFileName: () => ts.getDefaultLibFilePath(config.options),
        getCustomTransformers: getCustomTransformers
      }
      const { resolveModuleNames, getResolvedModuleWithFailedLookupLocationsFromCache, resolveTypeReferenceDirectives, isFileKnownToBeInternal, markBucketOfFilenameInternal } = createResolverFunctions(serviceHost)
      serviceHost.resolveModuleNames = resolveModuleNames
      serviceHost.getResolvedModuleWithFailedLookupLocationsFromCache = getResolvedModuleWithFailedLookupLocationsFromCache
      serviceHost.resolveTypeReferenceDirectives = resolveTypeReferenceDirectives

      const registry = ts.createDocumentRegistry(ts.sys.useCaseSensitiveFileNames, cwd)
      const service = ts.createLanguageService(serviceHost, registry)

      const updateMemoryCache = (contents: string, fileName: string) => {
        // Add to `rootFiles` as necessary, either to make TS include a file it has not seen,
        // or to trigger a re-classification of files from external to internal.
        if (!rootFileNames.has(fileName) && !isFileKnownToBeInternal(fileName)) {
          markBucketOfFilenameInternal(fileName)
          rootFileNames.add(fileName)
          // Increment project version for every change to rootFileNames.
          projectVersion++
        }

        const previousVersion = fileVersions.get(fileName) || 0
        const previousContents = fileContents.get(fileName)
        // Avoid incrementing cache when nothing has changed.
        if (contents !== previousContents) {
          fileVersions.set(fileName, previousVersion + 1)
          fileContents.set(fileName, contents)
          // Increment project version for every file change.
          projectVersion++
        }
      }

      let previousProgram: _ts.Program | undefined = undefined

      getOutput = (code: string, fileName: string) => {
        updateMemoryCache(code, fileName)

        const programBefore = service.getProgram()
        if (programBefore !== previousProgram) {
          debug(`compiler rebuilt Program instance when getting output for ${fileName}`)
        }

        const output = service.getEmitOutput(fileName)

        // Get the relevant diagnostics - this is 3x faster than `getPreEmitDiagnostics`.
        const diagnostics = service.getSemanticDiagnostics(fileName)
          .concat(service.getSyntacticDiagnostics(fileName))

        const programAfter = service.getProgram()

        debug(
          'invariant: Is service.getProject() identical before and after getting emit output and diagnostics? (should always be true) ',
          programBefore === programAfter
        )

        previousProgram = programAfter

        const diagnosticList = filterDiagnostics(diagnostics, ignoreDiagnostics)
        if (diagnosticList.length) reportTSError(diagnosticList)

        if (output.emitSkipped) {
          throw new TypeError(`${relative(cwd, fileName)}: Emit skipped`)
        }

        // Throw an error when requiring `.d.ts` files.
        if (output.outputFiles.length === 0) {
          throw new TypeError(
            `Unable to require file: ${relative(cwd, fileName)}\n` +
            'This is usually the result of a faulty configuration or import. ' +
            'Make sure there is a `.js`, `.json` or other executable extension with ' +
            'loader attached before `ts-node` available.'
          )
        }

        return [output.outputFiles[1].text, output.outputFiles[0].text]
      }

      getTypeInfo = (code: string, fileName: string, position: number) => {
        updateMemoryCache(code, fileName)

        const info = service.getQuickInfoAtPosition(fileName, position)
        const name = ts.displayPartsToString(info ? info.displayParts : [])
        const comment = ts.displayPartsToString(info ? info.documentation : [])

        return { name, comment }
      }
    } else {
      const sys: _ts.System & _ts.FormatDiagnosticsHost = {
        ...ts.sys,
        ...diagnosticHost,
        readFile: (fileName: string) => {
          const cacheContents = fileContents.get(fileName)
          if (cacheContents !== undefined) return cacheContents
          const contents = cachedReadFile(fileName)
          if (contents) fileContents.set(fileName, contents)
          return contents
        },
        readDirectory: ts.sys.readDirectory,
        getDirectories: cachedLookup(debugFn('getDirectories', ts.sys.getDirectories)),
        fileExists: cachedLookup(debugFn('fileExists', fileExists)),
        directoryExists: cachedLookup(debugFn('directoryExists', ts.sys.directoryExists)),
        resolvePath: cachedLookup(debugFn('resolvePath', ts.sys.resolvePath)),
        realpath: ts.sys.realpath ? cachedLookup(debugFn('realpath', ts.sys.realpath)) : undefined
      }

      const host: _ts.CompilerHost = ts.createIncrementalCompilerHost
        ? ts.createIncrementalCompilerHost(config.options, sys)
        : {
          ...sys,
          getSourceFile: (fileName, languageVersion) => {
            const contents = sys.readFile(fileName)
            if (contents === undefined) return
            return ts.createSourceFile(fileName, contents, languageVersion)
          },
          getDefaultLibLocation: () => normalizeSlashes(dirname(compiler)),
          getDefaultLibFileName: () => normalizeSlashes(join(dirname(compiler), ts.getDefaultLibFileName(config.options))),
          useCaseSensitiveFileNames: () => sys.useCaseSensitiveFileNames
        }
      const { resolveModuleNames, resolveTypeReferenceDirectives, isFileKnownToBeInternal, markBucketOfFilenameInternal } = createResolverFunctions(host)
      host.resolveModuleNames = resolveModuleNames
      host.resolveTypeReferenceDirectives = resolveTypeReferenceDirectives

      // Fallback for older TypeScript releases without incremental API.
      let builderProgram = ts.createIncrementalProgram
        ? ts.createIncrementalProgram({
          rootNames: Array.from(rootFileNames),
          options: config.options,
          host: host,
          configFileParsingDiagnostics: config.errors,
          projectReferences: config.projectReferences
        })
        : ts.createEmitAndSemanticDiagnosticsBuilderProgram(
          Array.from(rootFileNames),
          config.options,
          host,
          undefined,
          config.errors,
          config.projectReferences
        )

      // Read and cache custom transformers.
      const customTransformers = typeof transformers === 'function'
        ? transformers(builderProgram.getProgram())
        : transformers

      // Set the file contents into cache manually.
      const updateMemoryCache = (contents: string, fileName: string) => {
        const previousContents = fileContents.get(fileName)
        const contentsChanged = previousContents !== contents
        if (contentsChanged) {
          fileContents.set(fileName, contents)
        }

        // Add to `rootFiles` when discovered by compiler for the first time.
        let addedToRootFileNames = false
        if (!rootFileNames.has(fileName) && !isFileKnownToBeInternal(fileName)) {
          markBucketOfFilenameInternal(fileName)
          rootFileNames.add(fileName)
          addedToRootFileNames = true
        }

        // Update program when file changes.
        if (addedToRootFileNames || contentsChanged) {
          builderProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
            Array.from(rootFileNames),
            config.options,
            host,
            builderProgram,
            config.errors,
            config.projectReferences
          )
        }
      }

      getOutput = (code: string, fileName: string) => {
        const output: [string, string] = ['', '']

        updateMemoryCache(code, fileName)

        const sourceFile = builderProgram.getSourceFile(fileName)
        if (!sourceFile) throw new TypeError(`Unable to read file: ${fileName}`)

        const program = builderProgram.getProgram()
        const diagnostics = ts.getPreEmitDiagnostics(program, sourceFile)
        const diagnosticList = filterDiagnostics(diagnostics, ignoreDiagnostics)
        if (diagnosticList.length) reportTSError(diagnosticList)

        const result = builderProgram.emit(sourceFile, (path, file, writeByteOrderMark) => {
          if (path.endsWith('.map')) {
            output[1] = file
          } else {
            output[0] = file
          }

          if (options.emit) sys.writeFile(path, file, writeByteOrderMark)
        }, undefined, undefined, customTransformers)

        if (result.emitSkipped) {
          throw new TypeError(`${relative(cwd, fileName)}: Emit skipped`)
        }

        // Throw an error when requiring files that cannot be compiled.
        if (output[0] === '') {
          if (program.isSourceFileFromExternalLibrary(sourceFile)) {
            throw new TypeError(`Unable to compile file from external library: ${relative(cwd, fileName)}`)
          }

          throw new TypeError(
            `Unable to require file: ${relative(cwd, fileName)}\n` +
            'This is usually the result of a faulty configuration or import. ' +
            'Make sure there is a `.js`, `.json` or other executable extension with ' +
            'loader attached before `ts-node` available.'
          )
        }

        return output
      }

      getTypeInfo = (code: string, fileName: string, position: number) => {
        updateMemoryCache(code, fileName)

        const sourceFile = builderProgram.getSourceFile(fileName)
        if (!sourceFile) throw new TypeError(`Unable to read file: ${fileName}`)

        const node = getTokenAtPosition(ts, sourceFile, position)
        const checker = builderProgram.getProgram().getTypeChecker()
        const symbol = checker.getSymbolAtLocation(node)

        if (!symbol) return { name: '', comment: '' }

        const type = checker.getTypeOfSymbolAtLocation(symbol, node)
        const signatures = [...type.getConstructSignatures(), ...type.getCallSignatures()]

        return {
          name: signatures.length ? signatures.map(x => checker.signatureToString(x)).join('\n') : checker.typeToString(type),
          comment: ts.displayPartsToString(symbol ? symbol.getDocumentationComment(checker) : [])
        }
      }

      // Write `.tsbuildinfo` when `--build` is enabled.
      if (options.emit && config.options.incremental) {
        process.on('exit', () => {
          // Emits `.tsbuildinfo` to filesystem.
          (builderProgram.getProgram() as any).emitBuildInfo()
        })
      }
    }
  } else {
    if (typeof transformers === 'function') {
      throw new TypeError('Transformers function is unavailable in "--transpile-only"')
    }

    getOutput = (code: string, fileName: string): SourceOutput => {
      const result = ts.transpileModule(code, {
        fileName,
        compilerOptions: config.options,
        reportDiagnostics: true,
        transformers: transformers
      })

      const diagnosticList = filterDiagnostics(result.diagnostics || [], ignoreDiagnostics)
      if (diagnosticList.length) reportTSError(diagnosticList)

      return [result.outputText, result.sourceMapText as string]
    }

    getTypeInfo = () => {
      throw new TypeError('Type information is unavailable in "--transpile-only"')
    }
  }

  // Create a simple TypeScript compiler proxy.
  function compile (code: string, fileName: string, lineOffset = 0) {
    const normalizedFileName = normalizeSlashes(fileName)
    const [value, sourceMap] = getOutput(code, normalizedFileName)
    const output = updateOutput(value, normalizedFileName, sourceMap, getExtension)
    outputCache.set(normalizedFileName, { content: output })
    return output
  }

  let active = true
  const enabled = (enabled?: boolean) => enabled === undefined ? active : (active = !!enabled)
  const extensions = getExtensions(config)
  const ignored = (fileName: string) => {
    if (!active) return true
    const ext = extname(fileName)
    if (extensions.tsExtensions.includes(ext) || extensions.jsExtensions.includes(ext)) {
      return !isScoped(fileName) || shouldIgnore(fileName)
    }
    return true
  }

  return { ts, config, compile, getTypeInfo, ignored, enabled, options }
}

/**
 * Check if the filename should be ignored.
 */
function createIgnore (ignoreBaseDir: string, ignore: RegExp[]) {
  return (fileName: string) => {
    const relname = relative(ignoreBaseDir, fileName)
    const path = normalizeSlashes(relname)

    return ignore.some(x => x.test(path))
  }
}

/**
 * "Refreshes" an extension on `require.extensions`.
 *
 * @param {string} ext
 */
function reorderRequireExtension (ext: string) {
  const old = require.extensions[ext] // tslint:disable-line
  delete require.extensions[ext] // tslint:disable-line
  require.extensions[ext] = old // tslint:disable-line
}

/**
 * Register the extensions to support when importing files.
 */
function registerExtensions (
  preferTsExts: boolean | null | undefined,
  extensions: string[],
  service: Service,
  originalJsHandler: (m: NodeModule, filename: string) => any
) {
  // Register new extensions.
  for (const ext of extensions) {
    registerExtension(ext, service, originalJsHandler)
  }

  if (preferTsExts) {
    // tslint:disable-next-line:deprecation
    const preferredExtensions = new Set([...extensions, ...Object.keys(require.extensions)])

    for (const ext of preferredExtensions) reorderRequireExtension(ext)
  }
}

/**
 * Register the extension for node.
 */
function registerExtension (
  ext: string,
  service: Service,
  originalHandler: (m: NodeModule, filename: string) => any
) {
  const old = require.extensions[ext] || originalHandler // tslint:disable-line

  require.extensions[ext] = function (m: any, filename) { // tslint:disable-line
    if (service.ignored(filename)) return old(m, filename)

    assertScriptCanLoadAsCJS(filename)

    const _compile = m._compile

    m._compile = function (code: string, fileName: string) {
      debug('module._compile', fileName)

      return _compile.call(this, service.compile(code, fileName), fileName)
    }

    return old(m, filename)
  }
}

/**
 * Do post-processing on config options to support `ts-node`.
 */
function fixConfig (ts: TSCommon, config: _ts.ParsedCommandLine) {
  // Delete options that *should not* be passed through.
  delete config.options.out
  delete config.options.outFile
  delete config.options.composite
  delete config.options.declarationDir
  delete config.options.declarationMap
  delete config.options.emitDeclarationOnly

  // Target ES5 output by default (instead of ES3).
  if (config.options.target === undefined) {
    config.options.target = ts.ScriptTarget.ES5
  }

  // Target CommonJS modules by default (instead of magically switching to ES6 when the target is ES6).
  if (config.options.module === undefined) {
    config.options.module = ts.ModuleKind.CommonJS
  }

  return config
}

/**
 * Load TypeScript configuration. Returns the parsed TypeScript config and
 * any `ts-node` options specified in the config file.
 *
 * Even when a tsconfig.json is not loaded, this function still handles merging
 * compilerOptions from various sources: API, environment variables, etc.
 */
function readConfig (
  cwd: string,
  ts: TSCommon,
  rawApiOptions: CreateOptions
): {
  /**
   * Path of tsconfig file if one was loaded
   */
  configFilePath: string | undefined,
  /**
   * Parsed TypeScript configuration with compilerOptions merged from all other sources (env vars, etc)
   */
  config: _ts.ParsedCommandLine
  /**
   * ts-node options pulled from `tsconfig.json`, NOT merged with any other sources.  Merging must happen outside
   * this function.
   */
  tsNodeOptionsFromTsconfig: TsConfigOptions
} {
  let config: any = { compilerOptions: {} }
  let basePath = cwd
  let configFilePath: string | undefined = undefined
  const projectSearchDir = resolve(cwd, rawApiOptions.projectSearchDir ?? cwd)

  const {
    fileExists = ts.sys.fileExists,
    readFile = ts.sys.readFile,
    skipProject = DEFAULTS.skipProject,
    project = DEFAULTS.project
  } = rawApiOptions

  // Read project configuration when available.
  if (!skipProject) {
    configFilePath = project
      ? resolve(cwd, project)
      : ts.findConfigFile(projectSearchDir, fileExists)

    if (configFilePath) {
      const result = ts.readConfigFile(configFilePath, readFile)

      // Return diagnostics.
      if (result.error) {
        return {
          configFilePath,
          config: { errors: [result.error], fileNames: [], options: {} },
          tsNodeOptionsFromTsconfig: {}
        }
      }

      config = result.config
      basePath = dirname(configFilePath)
    }
  }

  // Fix ts-node options that come from tsconfig.json
  const tsNodeOptionsFromTsconfig: TsConfigOptions = Object.assign({}, filterRecognizedTsConfigTsNodeOptions(config['ts-node']))

  // Remove resolution of "files".
  const files = rawApiOptions.files ?? tsNodeOptionsFromTsconfig.files ?? DEFAULTS.files
  if (!files) {
    config.files = []
    config.include = []
  }

  const skipDefaultCompilerOptions = configFilePath != null || (rawApiOptions.skipDefaultCompilerOptions ?? DEFAULTS.skipDefaultCompilerOptions)
  const defaultCompilerOptionsForNodeVersion = skipDefaultCompilerOptions ? undefined : getDefaultTsconfigJsonForNodeVersion().compilerOptions
  console.error(util.inspect({ skipDefaultCompilerOptions, defaultCompilerOptionsForNodeVersion }))
  // Override default configuration options `ts-node` requires.
  config.compilerOptions = Object.assign(
    {},
    defaultCompilerOptionsForNodeVersion, // automatically-applied options from @tsconfig/bases
    config.compilerOptions, // tsconfig.json "compilerOptions"
    DEFAULTS.compilerOptions, // from env var
    tsNodeOptionsFromTsconfig.compilerOptions, // tsconfig.json "ts-node": "compilerOptions"
    rawApiOptions.compilerOptions, // passed programmatically
    TS_NODE_COMPILER_OPTIONS // overrides required by ts-node, cannot be changed
  )

  const fixedConfig = fixConfig(ts, ts.parseJsonConfigFileContent(config, {
    fileExists,
    readFile,
    readDirectory: ts.sys.readDirectory,
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames
  }, basePath, undefined, configFilePath))

  if (tsNodeOptionsFromTsconfig.require) {
    // Modules are found relative to the tsconfig file, not the `dir` option
    const tsconfigRelativeRequire = createRequire(configFilePath!)
    tsNodeOptionsFromTsconfig.require = tsNodeOptionsFromTsconfig.require.map((path: string) => {
      return tsconfigRelativeRequire.resolve(path)
    })
  }

  return { configFilePath, config: fixedConfig, tsNodeOptionsFromTsconfig }
}

/**
 * Given the raw "ts-node" sub-object from a tsconfig, return an object with only the properties
 * recognized by "ts-node"
 */
function filterRecognizedTsConfigTsNodeOptions (jsonObject: any): TsConfigOptions {
  if (jsonObject == null) return jsonObject
  const {
    compiler, compilerHost, compilerOptions, emit, files, ignore,
    ignoreDiagnostics, logError, preferTsExts, pretty, require, skipIgnore,
    transpileOnly, typeCheck
  } = jsonObject as TsConfigOptions
  const filteredTsConfigOptions = {
    compiler, compilerHost, compilerOptions, emit, files, ignore,
    ignoreDiagnostics, logError, preferTsExts, pretty, require, skipIgnore,
    transpileOnly, typeCheck
  }
  // Use the typechecker to make sure this implementation has the correct set of properties
  const catchExtraneousProps: keyof TsConfigOptions = null as any as keyof typeof filteredTsConfigOptions
  const catchMissingProps: keyof typeof filteredTsConfigOptions = null as any as keyof TsConfigOptions
  return filteredTsConfigOptions
}

/**
 * Internal source output.
 */
type SourceOutput = [string, string]

/**
 * Update the output remapping the source map.
 */
function updateOutput (outputText: string, fileName: string, sourceMap: string, getExtension: (fileName: string) => string) {
  const base64Map = Buffer.from(updateSourceMap(sourceMap, fileName), 'utf8').toString('base64')
  const sourceMapContent = `data:application/json;charset=utf-8;base64,${base64Map}`
  const sourceMapLength = `${basename(fileName)}.map`.length + (getExtension(fileName).length - extname(fileName).length)

  return outputText.slice(0, -sourceMapLength) + sourceMapContent
}

/**
 * Update the source map contents for improved output.
 */
function updateSourceMap (sourceMapText: string, fileName: string) {
  const sourceMap = JSON.parse(sourceMapText)
  sourceMap.file = fileName
  sourceMap.sources = [fileName]
  delete sourceMap.sourceRoot
  return JSON.stringify(sourceMap)
}

/**
 * Filter diagnostics.
 */
function filterDiagnostics (diagnostics: readonly _ts.Diagnostic[], ignore: number[]) {
  return diagnostics.filter(x => ignore.indexOf(x.code) === -1)
}

/**
 * Get token at file position.
 *
 * Reference: https://github.com/microsoft/TypeScript/blob/fcd9334f57d85b73dd66ad2d21c02e84822f4841/src/services/utilities.ts#L705-L731
 */
function getTokenAtPosition (ts: typeof _ts, sourceFile: _ts.SourceFile, position: number): _ts.Node {
  let current: _ts.Node = sourceFile

  outer: while (true) {
    for (const child of current.getChildren(sourceFile)) {
      const start = child.getFullStart()
      if (start > position) break

      const end = child.getEnd()
      if (position <= end) {
        current = child
        continue outer
      }
    }

    return current
  }
}
