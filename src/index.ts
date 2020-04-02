import { relative, basename, extname, resolve, dirname, join } from 'path'
import sourceMapSupport = require('source-map-support')
import * as ynModule from 'yn'
import { BaseError } from 'make-error'
import * as util from 'util'
import * as _ts from 'typescript'

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
      [REGISTER_INSTANCE]?: Register
    }
  }
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
const shouldDebug = yn(process.env.TS_NODE_DEBUG)
const timestamp = function(){};
timestamp.toString = function(){
  return "[ts-node " + (new Date).toISOString() + "]";
}
const debug = shouldDebug ? console.log.bind(console, '%s', timestamp) : () => undefined
const debugFn = shouldDebug ?
  <T, U> (key: string, fn: (arg: T) => U) => {
    let i = 0
    return (x: T) => {
      debug(key, x, ++i)
      return fn(x)
    }
  } :
  <T, U> (_: string, fn: (arg: T) => U) => fn

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
 * Export the current version.
 */
export const VERSION = require('../package.json').version

/**
 * Options for creating a new TypeScript compiler instance.
 */
export interface CreateOptions {
  /**
   * Specify working directory for config resolution.
   *
   * @default process.cwd()
   */
  dir?: string
  /**
   * Emit output files into `.ts-node` directory.
   *
   * @default false
   */
  emit?: boolean
  /**
   * Scope compiler to files within `cwd`.
   *
   * @default false
   */
  scope?: boolean
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
   * Use TypeScript's compiler host API.
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
   * Load files from `tsconfig.json` on startup.
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
   * Override the path patterns to skip compilation.
   *
   * @default /node_modules/
   * @docsDefault "/node_modules/"
   */
  ignore?: string[]
  /**
   * Path to TypeScript JSON project file.
   */
  project?: string
  /**
   * Skip project config resolution and loading.
   *
   * @default false
   */
  skipProject?: boolean
  /**
   * Skip ignore check.
   *
   * @default false
   */
  skipIgnore?: boolean
  /**
   * JSON object to merge with compiler options.
   *
   * @allOf [{"$ref": "https://schemastore.azurewebsites.net/schemas/json/tsconfig.json#definitions/compilerOptionsDefinition/properties/compilerOptions"}]
   */
  compilerOptions?: object
  /**
   * Ignore TypeScript warnings by diagnostic code.
   */
  ignoreDiagnostics?: Array<number | string>
  readFile?: (path: string) => string | undefined
  fileExists?: (path: string) => boolean
  transformers?: _ts.CustomTransformers | ((p: _ts.Program) => _ts.CustomTransformers)
}

/**
 * Options for registering a TypeScript compiler instance globally.
 */
export interface RegisterOptions extends CreateOptions {
  /**
   * Re-order file extensions so that TypeScript imports are preferred.
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
> {}

/**
 * Like `Object.assign`, but ignores `undefined` properties.
 */
function assign <T extends object> (initialValue: T, ...sources: Array<T>): T {
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
  dir: process.env.TS_NODE_DIR,
  emit: yn(process.env.TS_NODE_EMIT),
  scope: yn(process.env.TS_NODE_SCOPE),
  files: yn(process.env.TS_NODE_FILES),
  pretty: yn(process.env.TS_NODE_PRETTY),
  compiler: process.env.TS_NODE_COMPILER,
  compilerOptions: parse(process.env.TS_NODE_COMPILER_OPTIONS),
  ignore: split(process.env.TS_NODE_IGNORE),
  project: process.env.TS_NODE_PROJECT,
  skipProject: yn(process.env.TS_NODE_SKIP_PROJECT),
  skipIgnore: yn(process.env.TS_NODE_SKIP_IGNORE),
  preferTsExts: yn(process.env.TS_NODE_PREFER_TS_EXTS),
  ignoreDiagnostics: split(process.env.TS_NODE_IGNORE_DIAGNOSTICS),
  transpileOnly: yn(process.env.TS_NODE_TRANSPILE_ONLY),
  typeCheck: yn(process.env.TS_NODE_TYPE_CHECK),
  compilerHost: yn(process.env.TS_NODE_COMPILER_HOST),
  logError: yn(process.env.TS_NODE_LOG_ERROR)
}

/**
 * Default TypeScript compiler options required by `ts-node`.
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
 */
export function split (value: string | undefined) {
  return typeof value === 'string' ? value.split(/ *, */g) : undefined
}

/**
 * Parse a string as JSON.
 */
export function parse (value: string | undefined): object | undefined {
  return typeof value === 'string' ? JSON.parse(value) : undefined
}

/**
 * Replace backslashes with forward slashes.
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
 * Return type for registering `ts-node`.
 */
export interface Register {
  ts: TSCommon
  config: _ts.ParsedCommandLine
  options: RegisterOptions
  enabled (enabled?: boolean): boolean
  ignored (fileName: string): boolean
  compile (code: string, fileName: string, lineOffset?: number): string
  getTypeInfo (code: string, fileName: string, position: number): TypeInfo
}

/**
 * Cached fs operation wrapper.
 */
function cachedLookup <T> (fn: (arg: string) => T): (arg: string) => T {
  const cache = new Map<string, T>()

  return (arg: string): T => {
    if (!cache.has(arg)) {
      cache.set(arg, fn(arg))
    }

    return cache.get(arg)!
  }
}

/**
 * Register TypeScript compiler instance onto node.js
 */
export function register (opts: RegisterOptions = {}): Register {
  const originalJsHandler = require.extensions['.js'] // tslint:disable-line
  const service = create(opts)
  const extensions = ['.ts']

  // Enable additional extensions when JSX or `allowJs` is enabled.
  if (service.config.options.jsx) extensions.push('.tsx')
  if (service.config.options.allowJs) extensions.push('.js')
  if (service.config.options.jsx && service.config.options.allowJs) extensions.push('.jsx')

  // Expose registered instance globally.
  process[REGISTER_INSTANCE] = service

  // Register the extensions.
  registerExtensions(service.options.preferTsExts, extensions, service, originalJsHandler)

  return service
}

/**
 * Create TypeScript compiler instance.
 */
export function create (rawOptions: CreateOptions = {}): Register {
  const dir = rawOptions.dir ?? DEFAULTS.dir
  const compilerName = rawOptions.compiler ?? DEFAULTS.compiler
  const cwd = dir ? resolve(dir) : process.cwd()

  /**
   * Load the typescript compiler. It is required to load the tsconfig but might
   * be changed by the tsconfig, so we sometimes have to do this twice.
   */
  function loadCompiler (name: string | undefined) {
    const compiler = require.resolve(name || 'typescript', { paths: [cwd, __dirname] })
    const ts: typeof _ts = require(compiler)
    return { compiler, ts }
  }

  // Compute minimum options to read the config file.
  let { compiler, ts } = loadCompiler(compilerName)

  // Read config file and merge new options between env and CLI options.
  const { config, options: tsconfigOptions } = readConfig(cwd, ts, rawOptions)
  const options = assign<CreateOptions>({}, DEFAULTS, tsconfigOptions || {}, rawOptions)

  // If `compiler` option changed based on tsconfig, re-load the compiler.
  if (options.compiler !== compilerName) {
    ({ compiler, ts } = loadCompiler(options.compiler))
  }

  const readFile = options.readFile || ts.sys.readFile
  const fileExists = options.fileExists || ts.sys.fileExists
  const transpileOnly = options.transpileOnly === true || options.typeCheck === false
  const transformers = options.transformers || undefined
  const ignoreDiagnostics = [
    6059, // "'rootDir' is expected to contain all source files."
    18002, // "The 'files' list in config file is empty."
    18003, // "No inputs were found in config file."
    ...(options.ignoreDiagnostics || [])
  ].map(Number)

  const configDiagnosticList = filterDiagnostics(config.errors, ignoreDiagnostics)
  const outputCache = new Map<string, string>()

  const isScoped = options.scope ? (relname: string) => relname.charAt(0) !== '.' : () => true
  const shouldIgnore = createIgnore(options.skipIgnore ? [] : (
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
    retrieveFile (path: string) {
      return outputCache.get(path) || ''
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
  let getOutput: (code: string, fileName: string, lineOffset: number) => SourceOutput
  let getTypeInfo: (_code: string, _fileName: string, _position: number) => TypeInfo

  // Use full language services when the fast option is disabled.
  if (!transpileOnly) {
    const fileContents = new Map<string, string>()
    const rootFileNames = config.fileNames.slice()
    const cachedReadFile = cachedLookup(debugFn('readFile', readFile))

    // Use language services by default (TODO: invert next major version).
    if (!options.compilerHost) {
      let projectVersion = 1
      const fileVersions = new Map(rootFileNames.map(fileName => [fileName, 0]))

      const getCustomTransformers = () => {
        if (typeof transformers === 'function') {
          const program = service.getProgram()
          return program ? transformers(program) : undefined
        }

        return transformers
      }

      // Create the compiler host for type checking.
      const serviceHost: _ts.LanguageServiceHost = {
        getProjectVersion: () => String(projectVersion),
        getScriptFileNames: () => Array.from(fileVersions.keys()),
        getScriptVersion: (fileName: string) => {
          const version = fileVersions.get(fileName)
          return version ? version.toString() : ''
        },
        getScriptSnapshot (fileName: string) {
          let contents = fileContents.get(fileName)

          // Read contents into TypeScript memory cache.
          if (contents === undefined) {
            contents = cachedReadFile(fileName)
            if (contents === undefined) return

            fileVersions.set(fileName, 1)
            fileContents.set(fileName, contents)
          }

          return ts.ScriptSnapshot.fromString(contents)
        },
        readFile: cachedReadFile,
        readDirectory: ts.sys.readDirectory,
        getDirectories: cachedLookup(debugFn('getDirectories', ts.sys.getDirectories)),
        fileExists: cachedLookup(debugFn('fileExists', fileExists)),
        directoryExists: cachedLookup(debugFn('directoryExists', ts.sys.directoryExists)),
        getNewLine: () => ts.sys.newLine,
        useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
        getCurrentDirectory: () => cwd,
        getCompilationSettings: () => config.options,
        getDefaultLibFileName: () => ts.getDefaultLibFilePath(config.options),
        getCustomTransformers: getCustomTransformers
      }

      const registry = ts.createDocumentRegistry(ts.sys.useCaseSensitiveFileNames, cwd)
      const service = ts.createLanguageService(serviceHost, registry)

      const updateMemoryCache = (contents: string, fileName: string) => {
        // Add to `rootFiles` when discovered for the first time.
        if (!fileVersions.has(fileName)) {
          rootFileNames.push(fileName)
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
      const sys = {
        ...ts.sys,
        ...diagnosticHost,
        readFile: (fileName: string) => {
          const cacheContents = fileContents.get(fileName)
          if (cacheContents !== undefined) return cacheContents
          return cachedReadFile(fileName)
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

      // Fallback for older TypeScript releases without incremental API.
      let builderProgram = ts.createIncrementalProgram
        ? ts.createIncrementalProgram({
          rootNames: rootFileNames.slice(),
          options: config.options,
          host: host,
          configFileParsingDiagnostics: config.errors,
          projectReferences: config.projectReferences
        })
        : ts.createEmitAndSemanticDiagnosticsBuilderProgram(
          rootFileNames.slice(),
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
        const sourceFile = builderProgram.getSourceFile(fileName)

        fileContents.set(fileName, contents)

        // Add to `rootFiles` when discovered by compiler for the first time.
        if (sourceFile === undefined) {
          rootFileNames.push(fileName)
        }

        // Update program when file changes.
        if (sourceFile === undefined || sourceFile.text !== contents) {
          builderProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
            rootFileNames.slice(),
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
        transformers,
        compilerOptions: config.options,
        reportDiagnostics: true
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
    const [value, sourceMap] = getOutput(code, fileName, lineOffset)
    const output = updateOutput(value, fileName, sourceMap, getExtension)
    outputCache.set(fileName, output)
    return output
  }

  let active = true
  const enabled = (enabled?: boolean) => enabled === undefined ? active : (active = !!enabled)
  const ignored = (fileName: string) => {
    if (!active) return true
    const relname = relative(cwd, fileName)
    return !isScoped(relname) || shouldIgnore(relname)
  }

  return { ts, config, compile, getTypeInfo, ignored, enabled, options }
}

/**
 * Check if the filename should be ignored.
 */
function createIgnore (ignore: RegExp[]) {
  return (relname: string) => {
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
  register: Register,
  originalJsHandler: (m: NodeModule, filename: string) => any
) {
  // Register new extensions.
  for (const ext of extensions) {
    registerExtension(ext, register, originalJsHandler)
  }

  if (preferTsExts) {
    // tslint:disable-next-line
    const preferredExtensions = new Set([...extensions, ...Object.keys(require.extensions)])

    for (const ext of preferredExtensions) reorderRequireExtension(ext)
  }
}

/**
 * Register the extension for node.
 */
function registerExtension (
  ext: string,
  register: Register,
  originalHandler: (m: NodeModule, filename: string) => any
) {
  const old = require.extensions[ext] || originalHandler // tslint:disable-line

  require.extensions[ext] = function (m: any, filename) { // tslint:disable-line
    if (register.ignored(filename)) return old(m, filename)

    const _compile = m._compile

    m._compile = function (code: string, fileName: string) {
      debug('module._compile', fileName)

      return _compile.call(this, register.compile(code, fileName), fileName)
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
 */
function readConfig (
  cwd: string,
  ts: TSCommon,
  rawOptions: CreateOptions
): {
  // Parsed TypeScript configuration.
  config: _ts.ParsedCommandLine
  // Options pulled from `tsconfig.json`.
  options: TsConfigOptions
} {
  let config: any = { compilerOptions: {} }
  let basePath = cwd
  let configFileName: string | undefined = undefined

  const {
    fileExists = ts.sys.fileExists,
    readFile = ts.sys.readFile,
    skipProject = DEFAULTS.skipProject,
    project = DEFAULTS.project
  } = rawOptions

  // Read project configuration when available.
  if (!skipProject) {
    configFileName = project
      ? resolve(cwd, project)
      : ts.findConfigFile(cwd, fileExists)

    if (configFileName) {
      const result = ts.readConfigFile(configFileName, readFile)

      // Return diagnostics.
      if (result.error) {
        return {
          config: { errors: [result.error], fileNames: [], options: {} },
          options: {}
        }
      }

      config = result.config
      basePath = dirname(configFileName)
    }
  }

  // Fix ts-node options that come from tsconfig.json
  const tsconfigOptions: TsConfigOptions = Object.assign({}, config['ts-node'])

  // Remove resolution of "files".
  const files = rawOptions.files ?? tsconfigOptions.files ?? DEFAULTS.files
  if (!files) {
    config.files = []
    config.include = []
  }

  // Override default configuration options `ts-node` requires.
  config.compilerOptions = Object.assign(
    {},
    config.compilerOptions,
    DEFAULTS.compilerOptions,
    tsconfigOptions.compilerOptions,
    rawOptions.compilerOptions,
    TS_NODE_COMPILER_OPTIONS
  )

  const fixedConfig = fixConfig(ts, ts.parseJsonConfigFileContent(config, {
    fileExists,
    readFile,
    readDirectory: ts.sys.readDirectory,
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames
  }, basePath, undefined, configFileName))

  return { config: fixedConfig, options: tsconfigOptions }
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
