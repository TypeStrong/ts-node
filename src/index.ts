import { relative, basename, extname, resolve, dirname, join } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { EOL, tmpdir, homedir } from 'os'
import sourceMapSupport = require('source-map-support')
import mkdirp = require('mkdirp')
import crypto = require('crypto')
import yn = require('yn')
import arrify = require('arrify')
import bufferFrom = require('buffer-from')
import { BaseError } from 'make-error'
import * as util from 'util'
import * as ts from 'typescript'

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
    return (x: T) => {
      debug(key, x)
      return fn(x)
    }
  } :
  <T, U> (_: string, fn: (arg: T) => U) => fn

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
  files?: boolean | null
  cache?: boolean | null
  cacheDirectory?: string
  compiler?: string
  ignore?: string | string[]
  project?: string
  skipIgnore?: boolean | null
  skipProject?: boolean | null
  compilerOptions?: object
  ignoreDiagnostics?: number | string | Array<number | string>
  readFile?: (path: string) => string | undefined
  fileExists?: (path: string) => boolean
  transformers?: ts.CustomTransformers
}

/**
 * Track the project information.
 */
interface MemoryCache {
  contents: { [path: string]: string | undefined }
  versions: { [path: string]: number | undefined }
  outputs: { [path: string]: string }
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
  cache: yn(process.env['TS_NODE_CACHE'], { default: true }),
  pretty: yn(process.env['TS_NODE_PRETTY']),
  cacheDirectory: process.env['TS_NODE_CACHE_DIRECTORY'],
  compiler: process.env['TS_NODE_COMPILER'],
  compilerOptions: parse(process.env['TS_NODE_COMPILER_OPTIONS']),
  ignore: split(process.env['TS_NODE_IGNORE']),
  project: process.env['TS_NODE_PROJECT'],
  skipIgnore: yn(process.env['TS_NODE_SKIP_IGNORE']),
  skipProject: yn(process.env['TS_NODE_SKIP_PROJECT']),
  ignoreDiagnostics: split(process.env['TS_NODE_IGNORE_DIAGNOSTICS']),
  typeCheck: yn(process.env['TS_NODE_TYPE_CHECK']),
  transpileOnly: yn(process.env['TS_NODE_TRANSPILE_ONLY'])
}

/**
 * Default TypeScript compiler options required by `ts-node`.
 */
const DEFAULT_COMPILER_OPTIONS = {
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
  cachedir: string
  ts: typeof ts
  compile (code: string, fileName: string, lineOffset?: number): string
  getTypeInfo (code: string, fileName: string, position: number): TypeInfo
}

/**
 * Return a default temp directory based on home directory of user.
 */
function getTmpDir (): string {
  const hash = crypto.createHash('sha256').update(homedir(), 'utf8').digest('hex')

  return join(tmpdir(), `ts-node-${hash}`)
}

/**
 * Register TypeScript compiler.
 */
export function register (opts: Options = {}): Register {
  const options = Object.assign({}, DEFAULTS, opts)
  const cacheDirectory = options.cacheDirectory || getTmpDir()
  const originalJsHandler = require.extensions['.js']

  const ignoreDiagnostics = arrify(options.ignoreDiagnostics).concat([
    6059, // "'rootDir' is expected to contain all source files."
    18002, // "The 'files' list in config file is empty."
    18003 // "No inputs were found in config file."
  ]).map(Number)

  const memoryCache: MemoryCache = {
    contents: Object.create(null),
    versions: Object.create(null),
    outputs: Object.create(null)
  }

  const ignore = options.skipIgnore ? [] : arrify(
    options.ignore || '/node_modules/'
  ).map(str => new RegExp(str))

  // Install source map support and read from memory cache.
  sourceMapSupport.install({
    environment: 'node',
    retrieveFile (path: string) {
      return memoryCache.outputs[path]
    }
  })

  // Require the TypeScript compiler and configuration.
  const cwd = process.cwd()
  const { compilerOptions, project, skipProject } = options
  const compiler = options.compiler || 'typescript'
  const typeCheck = options.typeCheck === true || options.transpileOnly !== true
  const transformers = options.transformers || undefined
  const readFile = options.readFile || ts.sys.readFile
  const fileExists = options.fileExists || ts.sys.fileExists
  const config = readConfig(cwd, fileExists, readFile, compilerOptions, project, skipProject)
  const configDiagnosticList = filterDiagnostics(config.errors, ignoreDiagnostics)
  const extensions = ['.ts', '.tsx']
  const fileNames = options.files ? config.fileNames : []

  const cachedir = join(
    resolve(cwd, cacheDirectory),
    getCompilerDigest({
      version: ts.version,
      options: config.options,
      fileNames,
      typeCheck,
      ignoreDiagnostics,
      compiler
    })
  )

  const diagnosticHost: ts.FormatDiagnosticsHost = {
    getNewLine: () => EOL,
    getCurrentDirectory: () => cwd,
    getCanonicalFileName: (path) => path
  }

  const formatDiagnostics = options.pretty
    ? ts.formatDiagnosticsWithColorAndContext
    : ts.formatDiagnostics

  function createTSError (diagnostics: ReadonlyArray<ts.Diagnostic>) {
    const diagnosticText = formatDiagnostics(diagnostics, diagnosticHost)
    const diagnosticCodes = diagnostics.map(x => x.code)
    return new TSError(diagnosticText, diagnosticCodes)
  }

  // Render the configuration errors and exit the script.
  if (configDiagnosticList.length) throw createTSError(configDiagnosticList)

  // Enable `allowJs` when flag is set.
  if (config.options.allowJs) {
    extensions.push('.js')
    extensions.push('.jsx')
  }

  // Initialize files from TypeScript into project.
  for (const path of fileNames) memoryCache.versions[path] = 1

  /**
   * Get the extension for a transpiled file.
   */
  const getExtension = config.options.jsx === ts.JsxEmit.Preserve ?
    ((path: string) => /\.[tj]sx$/.test(path) ? '.jsx' : '.js') :
    ((_: string) => '.js')

  /**
   * Create the basic required function using transpile mode.
   */
  let getOutput = function (code: string, fileName: string, lineOffset = 0): SourceOutput {
    const result = ts.transpileModule(code, {
      fileName,
      transformers,
      compilerOptions: config.options,
      reportDiagnostics: true
    })

    const diagnosticList = result.diagnostics ?
      filterDiagnostics(result.diagnostics, ignoreDiagnostics) :
      []

    if (diagnosticList.length) throw createTSError(diagnosticList)

    return [result.outputText, result.sourceMapText as string]
  }

  let getTypeInfo = function (_code: string, _fileName: string, _position: number): TypeInfo {
    throw new TypeError(`Type information is unavailable without "--type-check"`)
  }

  // Use full language services when the fast option is disabled.
  if (typeCheck) {
    // Set the file contents into cache.
    const updateMemoryCache = function (code: string, fileName: string) {
      if (memoryCache.contents[fileName] !== code) {
        memoryCache.contents[fileName] = code
        memoryCache.versions[fileName] = (memoryCache.versions[fileName] || 0) + 1
      }
    }

    // Create the compiler host for type checking.
    const serviceHost = {
      getScriptFileNames: () => Object.keys(memoryCache.versions),
      getScriptVersion: (fileName: string) => {
        const version = memoryCache.versions[fileName]

        // We need to return `undefined` and not a string here because TypeScript will use
        // `getScriptVersion` and compare against their own version - which can be `undefined`.
        // If we don't return `undefined` it results in `undefined === "undefined"` and run
        // `createProgram` again (which is very slow). Using a `string` assertion here to avoid
        // TypeScript errors from the function signature (expects `(x: string) => string`).
        return version === undefined ? undefined as any as string : String(version)
      },
      getScriptSnapshot (fileName: string) {
        // Read contents into TypeScript memory cache.
        if (!Object.prototype.hasOwnProperty.call(memoryCache.contents, fileName)) {
          memoryCache.contents[fileName] = readFile(fileName)
        }

        const contents = memoryCache.contents[fileName]
        if (contents === undefined) return
        return ts.ScriptSnapshot.fromString(contents)
      },
      fileExists: debugFn('fileExists', fileExists),
      readFile: debugFn('readFile', readFile),
      readDirectory: debugFn('readDirectory', ts.sys.readDirectory),
      getDirectories: debugFn('getDirectories', ts.sys.getDirectories),
      directoryExists: debugFn('directoryExists', ts.sys.directoryExists),
      getNewLine: () => EOL,
      getCurrentDirectory: () => cwd,
      getCompilationSettings: () => config.options,
      getDefaultLibFileName: () => ts.getDefaultLibFilePath(config.options),
      getCustomTransformers: () => transformers
    }

    const service = ts.createLanguageService(serviceHost)

    getOutput = function (code: string, fileName: string, lineOffset: number = 0) {
      // Must set memory cache before attempting to read file.
      updateMemoryCache(code, fileName)

      const output = service.getEmitOutput(fileName)

      // Get the relevant diagnostics - this is 3x faster than `getPreEmitDiagnostics`.
      const diagnostics = service.getCompilerOptionsDiagnostics()
        .concat(service.getSyntacticDiagnostics(fileName))
        .concat(service.getSemanticDiagnostics(fileName))

      const diagnosticList = filterDiagnostics(diagnostics, ignoreDiagnostics)

      if (diagnosticList.length) throw createTSError(diagnosticList)

      if (output.emitSkipped) {
        throw new TypeError(`${relative(cwd, fileName)}: Emit skipped`)
      }

      // Throw an error when requiring `.d.ts` files.
      if (output.outputFiles.length === 0) {
        throw new TypeError(
          'Unable to require `.d.ts` file.\n' +
          'This is usually the result of a faulty configuration or import. ' +
          'Make sure there is a `.js`, `.json` or another executable extension and ' +
          'loader (attached before `ts-node`) available alongside ' +
          `\`${basename(fileName)}\`.`
        )
      }

      return [output.outputFiles[1].text, output.outputFiles[0].text]
    }

    getTypeInfo = function (code: string, fileName: string, position: number) {
      updateMemoryCache(code, fileName)

      const info = service.getQuickInfoAtPosition(fileName, position)
      const name = ts.displayPartsToString(info ? info.displayParts : [])
      const comment = ts.displayPartsToString(info ? info.documentation : [])

      return { name, comment }
    }
  }

  const compile = readThrough(cachedir, options.cache === true, memoryCache, getOutput, getExtension)
  const register: Register = { cwd, compile, getTypeInfo, extensions, cachedir, ts }

  // Register the extensions.
  extensions.forEach(extension => {
    registerExtension(extension, ignore, register, originalJsHandler)
  })

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
 * Register the extension for node.
 */
function registerExtension (
  ext: string,
  ignore: RegExp[],
  register: Register,
  originalHandler: (m: NodeModule, filename: string) => any
) {
  const old = require.extensions[ext] || originalHandler

  require.extensions[ext] = function (m: any, filename) {
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
function fixConfig (config: ts.ParsedCommandLine) {
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
  fileExists: (path: string) => boolean,
  readFile: (path: string) => string | undefined,
  compilerOptions?: object,
  project?: string | null,
  noProject?: boolean | null
): ts.ParsedCommandLine {
  let config = { compilerOptions: {} }
  let basePath = normalizeSlashes(cwd)
  let configFileName: string | undefined = undefined

  // Read project configuration when available.
  if (!noProject) {
    configFileName = project
      ? normalizeSlashes(resolve(cwd, project))
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

  // Override default configuration options `ts-node` requires.
  config.compilerOptions = Object.assign({}, config.compilerOptions, compilerOptions, DEFAULT_COMPILER_OPTIONS)

  return fixConfig(ts.parseJsonConfigFileContent(config, ts.sys, basePath, undefined, configFileName))
}

/**
 * Internal source output.
 */
type SourceOutput = [string, string]

/**
 * Wrap the function with caching.
 */
function readThrough (
  cachedir: string,
  shouldCache: boolean,
  memoryCache: MemoryCache,
  compile: (code: string, fileName: string, lineOffset?: number) => SourceOutput,
  getExtension: (fileName: string) => string
) {
  if (shouldCache === false) {
    return function (code: string, fileName: string, lineOffset?: number) {
      debug('readThrough', fileName)

      const [value, sourceMap] = compile(code, fileName, lineOffset)
      const output = updateOutput(value, fileName, sourceMap, getExtension)

      memoryCache.outputs[fileName] = output

      return output
    }
  }

  // Make sure the cache directory exists before continuing.
  mkdirp.sync(cachedir)

  return function (code: string, fileName: string, lineOffset?: number) {
    debug('readThrough', fileName)

    const cachePath = join(cachedir, getCacheName(code, fileName))
    const extension = getExtension(fileName)
    const outputPath = `${cachePath}${extension}`

    try {
      const output = readFileSync(outputPath, 'utf8')
      if (isValidCacheContent(output)) {
        memoryCache.outputs[fileName] = output
        return output
      }
    } catch (err) {/* Ignore. */}

    const [value, sourceMap] = compile(code, fileName, lineOffset)
    const output = updateOutput(value, fileName, sourceMap, getExtension)

    memoryCache.outputs[fileName] = output
    writeFileSync(outputPath, output)

    return output
  }
}

/**
 * Update the output remapping the source map.
 */
function updateOutput (outputText: string, fileName: string, sourceMap: string, getExtension: (fileName: string) => string) {
  const base64Map = bufferFrom(updateSourceMap(sourceMap, fileName), 'utf8').toString('base64')
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
 * Get the file name for the cache entry.
 */
function getCacheName (sourceCode: string, fileName: string) {
  return crypto.createHash('sha256')
    .update(extname(fileName), 'utf8')
    .update('\x00', 'utf8')
    .update(sourceCode, 'utf8')
    .digest('hex')
}

/**
 * Ensure the given cached content is valid by sniffing for a base64 encoded '}'
 * at the end of the content, which should exist if there is a valid sourceMap present.
 */
function isValidCacheContent (contents: string) {
  return /(?:9|0=|Q==)$/.test(contents.slice(-3))
}

/**
 * Create a hash of the current configuration.
 */
function getCompilerDigest (obj: object) {
  return crypto.createHash('sha256').update(JSON.stringify(obj), 'utf8').digest('hex')
}

/**
 * Filter diagnostics.
 */
function filterDiagnostics (diagnostics: ts.Diagnostic[], ignore: number[]) {
  return diagnostics.filter(x => ignore.indexOf(x.code) === -1)
}
