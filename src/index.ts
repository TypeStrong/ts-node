import { relative, basename, extname, resolve, dirname, join } from 'path'
import sourceMapSupport = require('source-map-support')
import yn from 'yn'
import { BaseError } from 'make-error'
import * as util from 'util'
import * as _ts from 'typescript'

/**
 * @internal
 */
export const INSPECT_CUSTOM = util.inspect.custom || 'inspect'

/**
 * Debugging `ts-node`.
 */
const shouldDebug = yn(process.env.TS_NODE_DEBUG)
const debug = shouldDebug ? console.log.bind(console, 'ts-node') : () => undefined
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
 * Registration options.
 */
export interface Options {
  cwd?: string | null
  build?: boolean | null
  pretty?: boolean | null
  typeCheck?: boolean | null
  transpileOnly?: boolean | null
  logError?: boolean | null
  files?: boolean | null
  compiler?: string
  ignore?: string[]
  project?: string
  skipProject?: boolean | null
  skipIgnore?: boolean | null
  preferTsExts?: boolean | null
  compilerOptions?: object
  ignoreDiagnostics?: Array<number | string>
  readFile?: (path: string) => string | undefined
  fileExists?: (path: string) => boolean
  transformers?: _ts.CustomTransformers | ((p: _ts.Program) => _ts.CustomTransformers)
}

/**
 * Track the project information.
 */
class MemoryCache {
  fileContents = new Map<string, string>()

  constructor (public rootFileNames: string[]) {}
}

/**
 * Information retrieved from type info check.
 */
export interface TypeInfo {
  name: string
  comment: string
}

/**
 * Default register options.
 */
export const DEFAULTS: Options = {
  cwd: process.env.TS_NODE_CWD,
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
  typeCheck: yn(process.env.TS_NODE_TYPE_CHECK),
  transpileOnly: yn(process.env.TS_NODE_TRANSPILE_ONLY),
  logError: yn(process.env.TS_NODE_LOG_ERROR),
  build: yn(process.env.TS_NODE_BUILD)
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
  cwd: string
  extensions: string[]
  ts: TSCommon
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
 * Register TypeScript compiler.
 */
export function register (opts: Options = {}): Register {
  const options = { ...DEFAULTS, ...opts }
  const originalJsHandler = require.extensions['.js'] // tslint:disable-line

  const ignoreDiagnostics = [
    6059, // "'rootDir' is expected to contain all source files."
    18002, // "The 'files' list in config file is empty."
    18003, // "No inputs were found in config file."
    ...(options.ignoreDiagnostics || [])
  ].map(Number)

  const ignore = options.skipIgnore ? [] : (options.ignore || ['/node_modules/']).map(str => new RegExp(str))

  // Require the TypeScript compiler and configuration.
  const cwd = options.cwd || process.cwd()
  const typeCheck = options.typeCheck === true || options.transpileOnly !== true
  const compiler = require.resolve(options.compiler || 'typescript', { paths: [cwd, __dirname] })
  const ts: typeof _ts = require(compiler)
  const transformers = options.transformers || undefined
  const readFile = options.readFile || ts.sys.readFile
  const fileExists = options.fileExists || ts.sys.fileExists
  const config = readConfig(cwd, ts, fileExists, readFile, options)
  const configDiagnosticList = filterDiagnostics(config.errors, ignoreDiagnostics)
  const extensions = ['.ts']
  const outputCache = new Map<string, string>()

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
    ? ts.formatDiagnosticsWithColorAndContext
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

  // Enable additional extensions when JSX or `allowJs` is enabled.
  if (config.options.jsx) extensions.push('.tsx')
  if (config.options.allowJs) extensions.push('.js')
  if (config.options.jsx && config.options.allowJs) extensions.push('.jsx')

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
  if (typeCheck) {
    const memoryCache = new MemoryCache(config.fileNames)
    const cachedReadFile = cachedLookup(debugFn('readFile', readFile))

    const getCustomTransformers = () => {
      if (typeof transformers === 'function') {
        return transformers(builderProgram.getProgram())
      }

      return transformers
    }

    const sys = {
      ...ts.sys,
      ...diagnosticHost,
      readFile: (fileName: string) => {
        const cacheContents = memoryCache.fileContents.get(fileName)
        if (cacheContents !== undefined) return cacheContents
        return cachedReadFile(fileName)
      },
      readDirectory: cachedLookup(debugFn('readDirectory', ts.sys.readDirectory)),
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
        rootNames: memoryCache.rootFileNames.slice(),
        options: config.options,
        host: host,
        configFileParsingDiagnostics: config.errors,
        projectReferences: config.projectReferences
      })
      : ts.createEmitAndSemanticDiagnosticsBuilderProgram(
        memoryCache.rootFileNames.slice(),
        config.options,
        host,
        undefined,
        config.errors,
        config.projectReferences
      )

    // Set the file contents into cache manually.
    const updateMemoryCache = (contents: string, fileName: string) => {
      const sourceFile = builderProgram.getSourceFile(fileName)

      memoryCache.fileContents.set(fileName, contents)

      // Add to `rootFiles` when discovered by compiler for the first time.
      if (sourceFile === undefined) {
        memoryCache.rootFileNames.push(fileName)
      }

      // Update program when file changes.
      if (sourceFile === undefined || sourceFile.text !== contents) {
        builderProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
          memoryCache.rootFileNames.slice(),
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

        if (options.build) sys.writeFile(path, file, writeByteOrderMark)
      }, undefined, undefined, getCustomTransformers())

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
    if (options.build && config.options.incremental) {
      process.on('exit', () => {
        // Emits `.tsbuildinfo` to filesystem.
        (builderProgram.getProgram() as any).emitBuildInfo()
      })
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

      const diagnosticList = result.diagnostics ?
        filterDiagnostics(result.diagnostics, ignoreDiagnostics) :
        []

      if (diagnosticList.length) reportTSError(configDiagnosticList)

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

  const register: Register = { cwd, compile, getTypeInfo, extensions, ts }

  // Register the extensions.
  registerExtensions(options.preferTsExts, extensions, ignore, register, originalJsHandler)

  return register
}

/**
 * Check if the filename should be ignored.
 */
function shouldIgnore (filename: string, ignore: RegExp[]) {
  const relname = normalizeSlashes(filename)

  return ignore.some(x => x.test(relname))
}

/**
 * "Refreshes" an extension on `require.extentions`.
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
  ignore: RegExp[],
  register: Register,
  originalJsHandler: (m: NodeModule, filename: string) => any
) {
  // Register new extensions.
  for (const ext of extensions) {
    registerExtension(ext, ignore, register, originalJsHandler)
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
  ignore: RegExp[],
  register: Register,
  originalHandler: (m: NodeModule, filename: string) => any
) {
  const old = require.extensions[ext] || originalHandler // tslint:disable-line

  require.extensions[ext] = function (m: any, filename) { // tslint:disable-line
    if (shouldIgnore(filename, ignore)) {
      return old(m, filename)
    }

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
 * Load TypeScript configuration.
 */
function readConfig (
  cwd: string,
  ts: TSCommon,
  fileExists: (path: string) => boolean,
  readFile: (path: string) => string | undefined,
  options: Options
): _ts.ParsedCommandLine {
  let config: any = { compilerOptions: {} }
  let basePath = normalizeSlashes(cwd)
  let configFileName: string | undefined = undefined

  // Read project configuration when available.
  if (!options.skipProject) {
    configFileName = options.project
      ? normalizeSlashes(resolve(cwd, options.project))
      : ts.findConfigFile(normalizeSlashes(cwd), fileExists)

    if (configFileName) {
      const result = ts.readConfigFile(configFileName, readFile)

      // Return diagnostics.
      if (result.error) {
        return { errors: [result.error], fileNames: [], options: {} }
      }

      config = result.config
      basePath = normalizeSlashes(dirname(configFileName))
    }
  }

  // Remove resolution of "files".
  if (!options.files) {
    config.files = []
    config.include = []
  }

  // Override default configuration options `ts-node` requires.
  config.compilerOptions = Object.assign({}, config.compilerOptions, options.compilerOptions, TS_NODE_COMPILER_OPTIONS)

  return fixConfig(ts, ts.parseJsonConfigFileContent(config, ts.sys, basePath, undefined, configFileName))
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
