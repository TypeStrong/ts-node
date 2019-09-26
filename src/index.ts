import { relative, basename, extname, resolve, dirname, join } from 'path'
import sourceMapSupport = require('source-map-support')
import yn from 'yn'
import { BaseError } from 'make-error'
import * as util from 'util'
import * as _ts from 'typescript'
import { writeFileSync } from 'fs'

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
  pretty?: boolean | null
  typeCheck?: boolean | null
  transpileOnly?: boolean | null
  logError?: boolean | null
  files?: boolean | null
  compiler?: string
  ignore?: string[]
  project?: string
  skipIgnore?: boolean | null
  skipProject?: boolean | null
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
  files: yn(process.env['TS_NODE_FILES']),
  pretty: yn(process.env['TS_NODE_PRETTY']),
  compiler: process.env['TS_NODE_COMPILER'],
  compilerOptions: parse(process.env['TS_NODE_COMPILER_OPTIONS']),
  ignore: split(process.env['TS_NODE_IGNORE']),
  project: process.env['TS_NODE_PROJECT'],
  skipIgnore: yn(process.env['TS_NODE_SKIP_IGNORE']),
  skipProject: yn(process.env['TS_NODE_SKIP_PROJECT']),
  preferTsExts: yn(process.env['TS_NODE_PREFER_TS_EXTS']),
  ignoreDiagnostics: split(process.env['TS_NODE_IGNORE_DIAGNOSTICS']),
  typeCheck: yn(process.env['TS_NODE_TYPE_CHECK']),
  transpileOnly: yn(process.env['TS_NODE_TRANSPILE_ONLY']),
  logError: yn(process.env['TS_NODE_LOG_ERROR'])
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
  outDir: '$$ts-node$$'
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
  const options = Object.assign({}, DEFAULTS, opts)
  const originalJsHandler = require.extensions['.js'] // tslint:disable-line

  const ignoreDiagnostics = [
    6059, // "'rootDir' is expected to contain all source files."
    18002, // "The 'files' list in config file is empty."
    18003, // "No inputs were found in config file."
    ...(options.ignoreDiagnostics || [])
  ].map(Number)

  const ignore = options.skipIgnore ? [] : (
    options.ignore || ['/node_modules/']
  ).map(str => new RegExp(str))

  // Require the TypeScript compiler and configuration.
  const cwd = process.cwd()
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
    getCanonicalFileName: (path) => path
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

    const host = ts.createIncrementalCompilerHost(config.options, {
      args: ts.sys.args,
      newLine: ts.sys.newLine,
      useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
      writeFile: ts.sys.writeFile,
      write: ts.sys.write,
      readFile: (fileName) => {
        if (memoryCache.fileContents.has(fileName)) {
          return memoryCache.fileContents.get(fileName)
        }

        return cachedReadFile(fileName)
      },
      readDirectory: cachedLookup(debugFn('readDirectory', ts.sys.readDirectory)),
      getDirectories: cachedLookup(debugFn('getDirectories', ts.sys.getDirectories)),
      fileExists: cachedLookup(debugFn('fileExists', fileExists)),
      directoryExists: cachedLookup(debugFn('directoryExists', ts.sys.directoryExists)),
      resolvePath: cachedLookup(debugFn('resolvePath', ts.sys.resolvePath)),
      createDirectory: ts.sys.createDirectory,
      getExecutingFilePath: ts.sys.getExecutingFilePath,
      getCurrentDirectory: () => cwd,
      exit: ts.sys.exit
    })

    let builderProgram = ts.createIncrementalProgram({
      rootNames: memoryCache.rootFileNames.slice(),
      host: host,
      options: config.options,
      configFileParsingDiagnostics: config.errors,
      projectReferences: config.projectReferences
    })

    // Set the file contents into cache manually.
    const updateMemoryCache = (contents: string, fileName: string) => {
      memoryCache.fileContents.set(fileName, contents)

      // Add to `rootFiles` when discovered by compiler for the first time.
      if (builderProgram.getSourceFile(fileName) === undefined) {
        memoryCache.rootFileNames.push(fileName)

        // Update program when root files change.
        builderProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram(memoryCache.rootFileNames.slice(), config.options, host, builderProgram, config.errors, config.projectReferences)
      }
    }

    getOutput = (code: string, fileName: string) => {
      const output: [string, string] = ['', '']

      updateMemoryCache(code, fileName)

      const sourceFile = builderProgram.getSourceFile(fileName)
      const diagnostics = ts.getPreEmitDiagnostics(builderProgram.getProgram(), sourceFile)
      const diagnosticList = filterDiagnostics(diagnostics, ignoreDiagnostics)

      if (diagnosticList.length) reportTSError(diagnosticList)

      const { emitSkipped } = builderProgram.emit(sourceFile, (path, file) => {
        if (path.endsWith('.map')) {
          output[1] = file
        } else {
          output[0] = file
        }
      }, undefined, undefined, getCustomTransformers())

      if (emitSkipped) {
        throw new TypeError(`${relative(cwd, fileName)}: Emit skipped`)
      }

      // Throw an error when requiring `.d.ts` files.
      if (output[0] === '') {
        throw new TypeError(
          'Unable to require `.d.ts` file.\n' +
          'This is usually the result of a faulty configuration or import. ' +
          'Make sure there is a `.js`, `.json` or another executable extension and ' +
          'loader (attached before `ts-node`) available alongside ' +
          `\`${basename(fileName)}\`.`
        )
      }

      return output
    }

    getTypeInfo = (code: string, fileName: string, position: number) => {
      updateMemoryCache(code, fileName)

      // const info = service.getQuickInfoAtPosition(fileName, position)
      // const name = ts.displayPartsToString(info ? info.displayParts : [])
      // const comment = ts.displayPartsToString(info ? info.documentation : [])

      return { name: '', comment: '' }
    }

    // process.on('exit', () => {
    //   (program.getProgram() as any).emitBuildInfo((path: string, file: string) => {
    //     writeFileSync(path, file)
    //   })
    // })
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
function fixConfig (ts: TSCommon, config: _ts.ParsedCommandLine, cwd: string) {
  // Delete options that *should not* be passed through.
  delete config.options.out
  delete config.options.outFile
  delete config.options.composite
  delete config.options.declarationDir
  delete config.options.declarationMap
  delete config.options.emitDeclarationOnly
  delete config.options.tsBuildInfoFile
  delete config.options.incremental

  // Target ES5 output by default (instead of ES3).
  if (config.options.target === undefined) {
    config.options.target = ts.ScriptTarget.ES5
  }

  // Target CommonJS modules by default (instead of magically switching to ES6 when the target is ES6).
  if (config.options.module === undefined) {
    config.options.module = ts.ModuleKind.CommonJS
  }

  // Enable incremental mode.
  config.options.incremental = true
  config.options.tsBuildInfoFile = join(cwd, 'ts-node.tsbuildinfo')

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

  return fixConfig(ts, ts.parseJsonConfigFileContent(config, ts.sys, basePath, undefined, configFileName), cwd)
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
