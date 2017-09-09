import { relative, basename, extname, resolve, dirname, join } from 'path'
import { writeFileSync, readFileSync, statSync } from 'fs'
import { EOL, tmpdir, homedir } from 'os'
import sourceMapSupport = require('source-map-support')
import chalk = require('chalk')
import mkdirp = require('mkdirp')
import crypto = require('crypto')
import yn = require('yn')
import arrify = require('arrify')
import { BaseError } from 'make-error'
import * as TS from 'typescript'
import { loadSync } from 'tsconfig'

const pkg = require('../package.json')
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
 * Common TypeScript interfaces between versions.
 */
export interface TSCommon {
  version: typeof TS.version
  sys: typeof TS.sys
  ScriptSnapshot: typeof TS.ScriptSnapshot
  displayPartsToString: typeof TS.displayPartsToString
  createLanguageService: typeof TS.createLanguageService
  getDefaultLibFilePath: typeof TS.getDefaultLibFilePath
  getPreEmitDiagnostics: typeof TS.getPreEmitDiagnostics
  flattenDiagnosticMessageText: typeof TS.flattenDiagnosticMessageText
  transpileModule: typeof TS.transpileModule
  ModuleKind: typeof TS.ModuleKind
  ScriptTarget: typeof TS.ScriptTarget
  findConfigFile: typeof TS.findConfigFile
  readConfigFile: typeof TS.readConfigFile
  parseJsonConfigFileContent: typeof TS.parseJsonConfigFileContent

  // TypeScript 1.5 and 1.6.
  parseConfigFile? (json: any, host: any, basePath: string): any
}

/**
 * Export the current version.
 */
export const VERSION = pkg.version

/**
 * Registration options.
 */
export interface Options {
  typeCheck?: boolean | null
  cache?: boolean | null
  cacheDirectory?: string
  compiler?: string
  project?: boolean | string
  ignore?: boolean | string | string[]
  ignoreWarnings?: number | string | Array<number | string>
  getFile?: (path: string) => string
  fileExists?: (path: string) => boolean
  compilerOptions?: any
}

/**
 * Track the project information.
 */
interface Cache {
  contents: { [path: string]: string }
  versions: { [path: string]: number }
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
const DEFAULTS = {
  getFile,
  fileExists,
  cache: yn(process.env['TS_NODE_CACHE'], { default: true }),
  cacheDirectory: process.env['TS_NODE_CACHE_DIRECTORY'],
  compiler: process.env['TS_NODE_COMPILER'],
  compilerOptions: parse(process.env['TS_NODE_COMPILER_OPTIONS']),
  project: process.env['TS_NODE_PROJECT'],
  ignore: split(process.env['TS_NODE_IGNORE']),
  ignoreWarnings: split(process.env['TS_NODE_IGNORE_WARNINGS']),
  typeCheck: yn(process.env['TS_NODE_FAST'])
}

/**
 * Split a string array of values.
 */
export function split (value: string | undefined) {
  return value ? value.split(/ *, */g) : undefined
}

/**
 * Parse a string as JSON.
 */
export function parse (value: string | undefined) {
  return value ? JSON.parse(value) : undefined
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

  constructor (public diagnostics: TSDiagnostic[]) {
    super(
      `⨯ Unable to compile TypeScript\n${diagnostics.map(x => x.message).join('\n')}`
    )
  }

}

/**
 * Return type for registering `ts-node`.
 */
export interface Register {
  cwd: string
  extensions: string[]
  cachedir: string
  ts: TSCommon
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
export function register (options: Options = {}): Register {
  const compiler = options.compiler || 'typescript'
  const emptyFileListWarnings = [18002, 18003]
  const ignoreWarnings = arrify(
    options.ignoreWarnings || DEFAULTS.ignoreWarnings || []
  ).concat(emptyFileListWarnings).map(Number)
  const getFile = options.getFile || DEFAULTS.getFile
  const fileExists = options.fileExists || DEFAULTS.fileExists
  const shouldCache = !!(options.cache == null ? DEFAULTS.cache : options.cache)
  const typeCheck = !!(options.typeCheck == null ? DEFAULTS.typeCheck : options.typeCheck)
  const project = options.project || DEFAULTS.project
  const cacheDirectory = options.cacheDirectory || DEFAULTS.cacheDirectory || getTmpDir()
  const compilerOptions = Object.assign({}, DEFAULTS.compilerOptions, options.compilerOptions)
  const originalJsHandler = require.extensions['.js']

  const cache: Cache = {
    contents: Object.create(null),
    versions: Object.create(null),
    outputs: Object.create(null)
  }

  const ignore = arrify(
    (
      typeof options.ignore === 'boolean' ?
        (options.ignore === false ? [] : undefined) :
        (options.ignore || DEFAULTS.ignore)
    ) ||
    ['/node_modules/']
  ).map(str => new RegExp(str))

  // Install source map support and read from cache.
  sourceMapSupport.install({
    environment: 'node',
    retrieveFile (path: string) {
      return cache.outputs[path]
    }
  })

  // Require the TypeScript compiler and configuration.
  const cwd = process.cwd()
  const ts: typeof TS = require(compiler)
  const config = readConfig(compilerOptions, project, cwd, ts)
  const configDiagnostics = filterDiagnostics(config.errors, ignoreWarnings)
  const extensions = ['.ts', '.tsx']

  const cachedir = join(
    resolve(cwd, cacheDirectory),
    getCompilerDigest({ version: ts.version, typeCheck, ignoreWarnings, config, compiler })
  )

  // Render the configuration errors and exit the script.
  if (configDiagnostics.length) {
    throw new TSError(formatDiagnostics(configDiagnostics, cwd, ts, 0))
  }

  // Enable `allowJs` when flag is set.
  if (config.options.allowJs) {
    extensions.push('.js')
  }

  // Add all files into the file hash.
  for (const fileName of config.fileNames) {
    if (/\.d\.ts$/.test(fileName)) {
      cache.versions[fileName] = 1
    }
  }

  /**
   * Get the extension for a transpiled file.
   */
  function getExtension (fileName: string) {
    if (config.options.jsx === ts.JsxEmit.Preserve && extname(fileName) === '.tsx') {
      return '.jsx'
    }

    return '.js'
  }

  /**
   * Create the basic required function using transpile mode.
   */
  let getOutput = function (code: string, fileName: string, lineOffset = 0): SourceOutput {
    const result = ts.transpileModule(code, {
      fileName,
      compilerOptions: config.options,
      reportDiagnostics: true
    })

    const diagnosticList = result.diagnostics ?
      filterDiagnostics(result.diagnostics, ignoreWarnings) :
      []

    if (diagnosticList.length) {
      throw new TSError(formatDiagnostics(diagnosticList, cwd, ts, lineOffset))
    }

    return [result.outputText, result.sourceMapText as string]
  }

  let compile = readThrough(
    cachedir,
    shouldCache,
    getFile,
    cache,
    getOutput,
    getExtension
  )

  let getTypeInfo = function (_code: string, _fileName: string, _position: number): TypeInfo {
    throw new TypeError(`No type information available under "--fast" mode`)
  }

  // Use full language services when the fast option is disabled.
  if (typeCheck) {
    // Set the file contents into cache.
    const setCache = function (code: string, fileName: string) {
      cache.contents[fileName] = code
      cache.versions[fileName] = (cache.versions[fileName] + 1) || 1
    }

    // Create the compiler host for type checking.
    const serviceHost = {
      getScriptFileNames: () => Object.keys(cache.versions),
      getScriptVersion: (fileName: string) => String(cache.versions[fileName]),
      getScriptSnapshot (fileName: string) {
        if (!cache.contents[fileName]) {
          if (!fileExists(fileName)) {
            return undefined
          }

          cache.contents[fileName] = getFile(fileName)
        }

        return ts.ScriptSnapshot.fromString(cache.contents[fileName])
      },
      fileExists: debugFn('fileExists', fileExists),
      readFile: debugFn('getFile', getFile),
      readDirectory: debugFn('readDirectory', ts.sys.readDirectory),
      getDirectories: debugFn('getDirectories', ts.sys.getDirectories),
      directoryExists: debugFn('directoryExists', ts.sys.directoryExists),
      getNewLine: () => EOL,
      getCurrentDirectory: () => cwd,
      getCompilationSettings: () => config.options,
      getDefaultLibFileName: () => ts.getDefaultLibFilePath(config.options)
    }

    const service = ts.createLanguageService(serviceHost)

    getOutput = function (_code: string, fileName: string, lineOffset: number = 0) {
      const output = service.getEmitOutput(fileName)

      // Get the relevant diagnostics - this is 3x faster than `getPreEmitDiagnostics`.
      const diagnostics = service.getCompilerOptionsDiagnostics()
        .concat(service.getSyntacticDiagnostics(fileName))
        .concat(service.getSemanticDiagnostics(fileName))

      const diagnosticList = filterDiagnostics(diagnostics, ignoreWarnings)

      if (diagnosticList.length) {
        throw new TSError(formatDiagnostics(diagnosticList, cwd, ts, lineOffset))
      }

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

    compile = readThrough(
      cachedir,
      shouldCache,
      getFile,
      cache,
      function (code: string, fileName: string, lineOffset?: number) {
        setCache(code, fileName)

        return getOutput(code, fileName, lineOffset)
      },
      getExtension
    )

    getTypeInfo = function (code: string, fileName: string, position: number) {
      setCache(code, fileName)

      const info = service.getQuickInfoAtPosition(fileName, position)
      const name = ts.displayPartsToString(info ? info.displayParts : [])
      const comment = ts.displayPartsToString(info ? info.documentation : [])

      return { name, comment }
    }
  }

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
 * Do post-processing on config options to correct them.
 */
function fixConfig (config: any, ts: TSCommon) {
  // Delete options that *should not* be passed through.
  delete config.options.out
  delete config.options.outFile
  delete config.options.declarationDir

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
function readConfig (compilerOptions: any, project: string | boolean | undefined, cwd: string, ts: TSCommon) {
  const result = loadSync(cwd, typeof project === 'string' ? project : undefined)

  // Override default configuration options.
  result.config.compilerOptions = Object.assign({}, result.config.compilerOptions, compilerOptions, {
    sourceMap: true,
    inlineSourceMap: false,
    inlineSources: true,
    declaration: false,
    noEmit: false,
    outDir: '$$ts-node$$'
  })

  const configPath = result.path && normalizeSlashes(result.path)
  const basePath = configPath ? dirname(configPath) : normalizeSlashes(cwd)

  if (typeof ts.parseConfigFile === 'function') {
    return fixConfig(ts.parseConfigFile(result.config, ts.sys, basePath), ts)
  }

  if (typeof ts.parseJsonConfigFileContent === 'function') {
    return fixConfig(ts.parseJsonConfigFileContent(result.config, ts.sys, basePath, undefined, configPath as string), ts)
  }

  throw new TypeError('Could not find a compatible `parseConfigFile` function')
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
  getFile: (fileName: string) => string,
  cache: Cache,
  compile: (code: string, fileName: string, lineOffset?: number) => SourceOutput,
  getExtension: (fileName: string) => string
) {
  if (shouldCache === false) {
    return function (code: string, fileName: string, lineOffset?: number) {
      debug('readThrough', fileName)

      const [value, sourceMap] = compile(code, fileName, lineOffset)
      const output = updateOutput(value, fileName, sourceMap, getExtension)

      cache.outputs[fileName] = output

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
      const output = getFile(outputPath)
      if (isValidCacheContent(output)) {
        cache.outputs[fileName] = output
        return output
      }
    } catch (err) {/* Ignore. */}

    const [value, sourceMap] = compile(code, fileName, lineOffset)
    const output = updateOutput(value, fileName, sourceMap, getExtension)

    cache.outputs[fileName] = output
    writeFileSync(outputPath, output)

    return output
  }
}

/**
 * Update the output remapping the source map.
 */
function updateOutput (outputText: string, fileName: string, sourceMap: string, getExtension: (fileName: string) => string) {
  const base64Map = new Buffer(updateSourceMap(sourceMap, fileName), 'utf8').toString('base64')
  const sourceMapContent = `data:application/json;charset=utf-8;base64,${base64Map}`
  const sourceMapLength = `${basename(fileName)}.map`.length + (getExtension(fileName).length - extname(fileName).length)

  return outputText.slice(0, -1 * sourceMapLength) + sourceMapContent
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
    .update('\x001\x00', 'utf8') // Store "cache version" in hash.
    .update(sourceCode, 'utf8')
    .digest('hex')
}

/**
 * Ensure the given cached content is valid by sniffing for a base64 encoded '}'
 * at the end of the content, which should exist if there is a valid sourceMap present.
 */
function isValidCacheContent (content: string) {
  return /(?:9|0=|Q==)$/.test(content.slice(-3))
}

/**
 * Create a hash of the current configuration.
 */
function getCompilerDigest (opts: any) {
  return crypto.createHash('sha256').update(JSON.stringify(opts), 'utf8').digest('hex')
}

/**
 * Check if the file exists.
 */
export function fileExists (fileName: string): boolean {
  try {
    const stats = statSync(fileName)

    return stats.isFile() || stats.isFIFO()
  } catch (err) {
    return false
  }
}

/**
 * Get the file from the file system.
 */
export function getFile (fileName: string): string {
  return readFileSync(fileName, 'utf8')
}

/**
 * Filter diagnostics.
 */
function filterDiagnostics (diagnostics: TS.Diagnostic[], ignore: number[]) {
  return diagnostics.filter(x => ignore.indexOf(x.code) === -1)
}

/**
 * Format an array of diagnostics.
 */
export function formatDiagnostics (diagnostics: TS.Diagnostic[], cwd: string, ts: TSCommon, lineOffset: number) {
  return diagnostics.map(x => formatDiagnostic(x, cwd, ts, lineOffset))
}

/**
 * Internal diagnostic representation.
 */
export interface TSDiagnostic {
  message: string
  code: number
}

/**
 * Format a diagnostic object into a string.
 */
export function formatDiagnostic (
  diagnostic: TS.Diagnostic,
  cwd: string,
  ts: TSCommon,
  lineOffset: number
): TSDiagnostic {
  const messageText = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  const { code } = diagnostic

  if (diagnostic.file) {
    const path = relative(cwd, diagnostic.file.fileName)

    if (diagnostic.start) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
      const message = `${path} (${line + 1 + lineOffset},${character + 1}): ${messageText} (${code})`

      return { message, code }
    }

    return { message: `${path}: ${messageText} (${code})`, code }
  }

  return { message: `${messageText} (${code})`, code }
}

/**
 * Stringify the `TSError` instance.
 */
export function printError (error: TSError) {
  const title = `${chalk.red('⨯')} Unable to compile TypeScript`

  return `${chalk.bold(title)}\n${error.diagnostics.map(x => x.message).join('\n')}`
}
