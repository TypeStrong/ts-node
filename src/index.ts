import { relative, basename, extname, resolve, dirname, join } from 'path'
import { readdirSync, writeFileSync, readFileSync, statSync } from 'fs'
import { EOL, tmpdir, homedir } from 'os'
import sourceMapSupport = require('source-map-support')
import mkdirp = require('mkdirp')
import crypto = require('crypto')
import yn = require('yn')
import arrify = require('arrify')
import { BaseError } from 'make-error'
import * as TS from 'typescript'
import { loadSync } from 'tsconfig'

const pkg = require('../package.json')

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
  fast?: boolean | null
  cache?: boolean | null
  cacheDirectory?: string
  compiler?: string
  project?: boolean | string
  ignore?: boolean | string | string[]
  ignoreWarnings?: number | string | Array<number | string>
  disableWarnings?: boolean | null
  getFile?: (fileName: string) => string
  fileExists?: (fileName: string) => boolean
  compilerOptions?: any
}

/**
 * Track the project information.
 */
interface Cache {
  contents: { [fileName: string]: string }
  versions: { [fileName: string]: number }
  sourceMaps: { [fileName: string]: string }
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
  cache: yn(process.env['TS_NODE_CACHE']),
  cacheDirectory: process.env['TS_NODE_CACHE_DIRECTORY'],
  disableWarnings: yn(process.env['TS_NODE_DISABLE_WARNINGS']),
  compiler: process.env['TS_NODE_COMPILER'],
  compilerOptions: parse(process.env['TS_NODE_COMPILER_OPTIONS']),
  project: process.env['TS_NODE_PROJECT'],
  ignore: split(process.env['TS_NODE_IGNORE']),
  ignoreWarnings: split(process.env['TS_NODE_IGNORE_WARNINGS']),
  fast: yn(process.env['TS_NODE_FAST'])
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

export interface Register {
  cwd: string
  extensions: string[]
  compile (code: string, fileName: string, lineOffset?: number): string
  getTypeInfo (fileName: string, position: number): TypeInfo
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
  const disableWarnings = !!(options.disableWarnings == null ? DEFAULTS.disableWarnings : options.disableWarnings)
  const getFile = options.getFile || DEFAULTS.getFile
  const fileExists = options.fileExists || DEFAULTS.fileExists
  const shouldCache = !!(options.cache == null ? DEFAULTS.cache : options.cache)
  const fast = !!(options.fast == null ? DEFAULTS.fast : options.fast)
  const project = options.project || DEFAULTS.project
  const cacheDirectory = options.cacheDirectory || DEFAULTS.cacheDirectory || getTmpDir()
  const compilerOptions = Object.assign({}, DEFAULTS.compilerOptions, options.compilerOptions)
  const originalJsHandler = require.extensions['.js']
  const cache: Cache = { contents: {}, versions: {}, sourceMaps: {} }

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
    retrieveSourceMap (fileName: string) {
      if (cache.sourceMaps[fileName]) {
        return {
          url: cache.sourceMaps[fileName],
          map: getFile(cache.sourceMaps[fileName])
        }
      }
    }
  })

  // Require the TypeScript compiler and configuration.
  const cwd = process.cwd()
  const ts: typeof TS = require(compiler)
  const config = readConfig(compilerOptions, project, cwd, ts)
  const configDiagnostics = filterDiagnostics(config.errors, ignoreWarnings, disableWarnings)
  const extensions = ['.ts', '.tsx']

  const cachedir = join(
    resolve(cwd, cacheDirectory),
    getCompilerDigest({ version: ts.version, fast, ignoreWarnings, disableWarnings, config, compiler })
  )

  // Make sure the cache directory _always_ exists (source maps write there).
  mkdirp.sync(cachedir)

  // Render the configuration errors and exit the script.
  if (configDiagnostics.length) {
    throw new TSError(formatDiagnostics(configDiagnostics, cwd, ts, 0))
  }

  // Target ES5 output by default (instead of ES3).
  if (config.options.target === undefined) {
    config.options.target = ts.ScriptTarget.ES5
  }

  // Target CommonJS modules by default (instead of magically switching to ES6 when the target is ES6).
  if (config.options.module === undefined) {
    config.options.module = ts.ModuleKind.CommonJS
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
      filterDiagnostics(result.diagnostics, ignoreWarnings, disableWarnings) :
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
    fileExists,
    cache,
    getOutput,
    getExtension
  )

  let getTypeInfo = function (_fileName: string, _position: number): TypeInfo {
    throw new TypeError(`No type information available under "--fast" mode`)
  }

  // Use full language services when the fast option is disabled.
  if (!fast) {
    // Add the file to the project.
    const addVersion = function (fileName: string) {
      if (!cache.versions.hasOwnProperty(fileName)) {
        cache.versions[fileName] = 1
      }
    }

    // Set the file contents into cache.
    const addCache = function (code: string, fileName: string) {
      cache.contents[fileName] = code
      cache.versions[fileName] += 1
    }

    // Create the compiler host for type checking.
    const serviceHost = {
      getScriptFileNames: () => Object.keys(cache.versions),
      getScriptVersion: (fileName: string) => String(cache.versions[fileName]),
      getScriptSnapshot (fileName: string) {
        if (!cache.contents.hasOwnProperty(fileName)) {
          if (!fileExists(fileName)) {
            return undefined
          }

          cache.contents[fileName] = getFile(fileName)
        }

        return ts.ScriptSnapshot.fromString(cache.contents[fileName])
      },
      getDirectories: getDirectories,
      directoryExists: directoryExists,
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

      const diagnosticList = filterDiagnostics(diagnostics, ignoreWarnings, disableWarnings)

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
      fileExists,
      cache,
      function (code: string, fileName: string, lineOffset?: number) {
        addVersion(fileName)
        addCache(code, fileName)

        return getOutput(code, fileName, lineOffset)
      },
      getExtension
    )

    getTypeInfo = function (fileName: string, position: number) {
      addVersion(fileName)

      const info = service.getQuickInfoAtPosition(fileName, position)
      const name = ts.displayPartsToString(info ? info.displayParts : [])
      const comment = ts.displayPartsToString(info ? info.documentation : [])

      return { name, comment }
    }
  }

  const register: Register = { cwd, compile, getTypeInfo, extensions }

  // Register the extensions.
  extensions.forEach(extension => registerExtension(extension, ignore, register, originalJsHandler))

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

  require.extensions[ext] = function (m, filename) {
    if (shouldIgnore(filename, ignore)) {
      return old(m, filename)
    }

    const _compile = m._compile

    m._compile = function (code, fileName) {
      return _compile.call(this, register.compile(code, fileName), fileName)
    }

    return old(m, filename)
  }
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

  // Delete options that *should not* be passed through.
  delete result.config.compilerOptions.out
  delete result.config.compilerOptions.outFile
  delete result.config.compilerOptions.declarationDir

  const configPath = result.path && normalizeSlashes(result.path)
  const basePath = configPath ? dirname(configPath) : normalizeSlashes(cwd)

  if (typeof ts.parseConfigFile === 'function') {
    return ts.parseConfigFile(result.config, ts.sys, basePath)
  }

  if (typeof ts.parseJsonConfigFileContent === 'function') {
    return ts.parseJsonConfigFileContent(result.config, ts.sys, basePath, undefined, configPath as string)
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
  fileExists: (fileName: string) => boolean,
  cache: Cache,
  compile: (code: string, fileName: string, lineOffset?: number) => SourceOutput,
  getExtension: (fileName: string) => string
) {
  if (shouldCache === false) {
    return function (code: string, fileName: string, lineOffset?: number) {
      const cachePath = join(cachedir, getCacheName(code, fileName))
      const extension = getExtension(fileName)
      const sourceMapPath = `${cachePath}${extension}.map`
      const out = compile(code, fileName, lineOffset)

      cache.sourceMaps[fileName] = sourceMapPath

      const output = updateOutput(out[0], fileName, extension, sourceMapPath)
      const sourceMap = updateSourceMap(out[1], fileName)

      writeFileSync(sourceMapPath, sourceMap)

      return output
    }
  }

  return function (code: string, fileName: string, lineOffset?: number) {
    const cachePath = join(cachedir, getCacheName(code, fileName))
    const extension = getExtension(fileName)
    const outputPath = `${cachePath}${extension}`
    const sourceMapPath = `${outputPath}.map`

    cache.sourceMaps[fileName] = sourceMapPath

    // Use the cache when available.
    if (fileExists(outputPath)) {
      return getFile(outputPath)
    }

    const out = compile(code, fileName, lineOffset)

    const output = updateOutput(out[0], fileName, extension, sourceMapPath)
    const sourceMap = updateSourceMap(out[1], fileName)

    writeFileSync(outputPath, output)
    writeFileSync(sourceMapPath, sourceMap)

    return output
  }
}

/**
 * Update the output remapping the source map.
 */
function updateOutput (outputText: string, fileName: string, extension: string, sourceMapPath: string) {
  // Replace the original extension (E.g. `.ts`).
  const ext = extname(fileName)
  const originalPath = basename(fileName).slice(0, -ext.length) + `${extension}.map`
  return outputText.slice(0, -originalPath.length) + sourceMapPath.replace(/\\/g, '/')
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
    .update('\0', 'utf8')
    .update(sourceCode, 'utf8')
    .digest('hex')
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
 * Get directories within a directory.
 */
export function getDirectories (path: string): string[] {
  return readdirSync(path).filter(name => directoryExists(join(path, name)))
}

/**
 * Check if a directory exists.
 */
export function directoryExists (path: string): boolean {
  try {
    return statSync(path).isDirectory()
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
function filterDiagnostics (diagnostics: TS.Diagnostic[], ignore: number[], disable: boolean) {
  if (disable) {
    return []
  }

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

  if (diagnostic.file) {
    const path = relative(cwd, diagnostic.file.fileName)
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
    const message = `${path} (${line + 1 + lineOffset},${character + 1}): ${messageText} (${diagnostic.code})`

    return { message, code: diagnostic.code }
  }

  return { message: `${messageText} (${diagnostic.code})`, code: diagnostic.code }
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
