import { relative, basename, extname, resolve, dirname, join } from 'path'
import { readdirSync, writeFileSync, readFileSync, statSync } from 'fs'
import { EOL, tmpdir } from 'os'
import sourceMapSupport = require('source-map-support')
import extend = require('xtend')
import mkdirp = require('mkdirp')
import crypto = require('crypto')
import yn = require('yn')
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

  // TypeScript 1.5+, 1.7+ added `fileExists` parameter.
  findConfigFile (path: string, fileExists?: (path: string) => boolean): string

  // TypeScript 1.5+, 1.7+ added `readFile` parameter.
  readConfigFile (path: string, readFile?: (path: string) => string): {
    config?: any
    error?: TS.Diagnostic
  }

  // TypeScript 1.7+.
  parseJsonConfigFileContent? (
    json: any,
    host: any,
    basePath: string,
    existingOptions: any,
    configFileName: string
  ): any

  // TypeScript 1.5+.
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
  lazy?: boolean | null
  cache?: boolean | null
  cacheDirectory?: string
  compiler?: string
  project?: boolean | string
  ignore?: boolean | string[]
  ignoreWarnings?: Array<number | string>
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
  cache: yn(process.env.TS_NODE_CACHE),
  cacheDirectory: process.env.TS_NODE_CACHE_DIRECTORY,
  disableWarnings: yn(process.env.TS_NODE_DISABLE_WARNINGS),
  compiler: process.env.TS_NODE_COMPILER,
  compilerOptions: process.env.TS_NODE_COMPILER_OPTIONS,
  project: process.env.TS_NODE_PROJECT,
  ignore: split(process.env.TS_NODE_IGNORE),
  ignoreWarnings: split(process.env.TS_NODE_IGNORE_WARNINGS),
  fast: yn(process.env.TS_NODE_FAST)
}

/**
 * Split a string array of values.
 */
function split (value: string | undefined) {
  return value ? value.split(/ *, */g) : []
}

/**
 * Replace backslashes with forward slashes.
 */
function slash (value: string): string {
  return value.replace(/\\/g, '/')
}

export interface Register {
  cwd: string
  compile (code: string, fileName: string): string
  getTypeInfo (fileName: string, position: number): TypeInfo
}

/**
 * Register TypeScript compiler.
 */
export function register (options: Options = {}): () => Register {
  const compiler = options.compiler || 'typescript'
  const ignoreWarnings = (options.ignoreWarnings || DEFAULTS.ignoreWarnings).map(Number)
  const disableWarnings = !!(options.disableWarnings == null ? DEFAULTS.disableWarnings : options.disableWarnings)
  const getFile = options.getFile || DEFAULTS.getFile
  const fileExists = options.fileExists || DEFAULTS.fileExists
  const shouldCache = !!(options.cache == null ? DEFAULTS.cache : options.cache)
  const fast = !!(options.fast == null ? DEFAULTS.fast : options.fast)
  const project = options.project || DEFAULTS.project
  const cacheDirectory = options.cacheDirectory || DEFAULTS.cacheDirectory || join(tmpdir(), 'ts-node')
  let result: Register

  const ignore = (
    (
      typeof options.ignore === 'boolean' ?
        (options.ignore === false ? [] : undefined) :
        (options.ignore || DEFAULTS.ignore)
    ) ||
    ['^node_modules/']
  ).map(str => new RegExp(str))

  // Parse compiler options as JSON.
  const compilerOptions = typeof options.compilerOptions === 'string' ?
    JSON.parse(options.compilerOptions) :
    options.compilerOptions

  function load () {
    const cache: Cache = { contents: {}, versions: {}, sourceMaps: {} }

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
    const configDiagnostics = formatDiagnostics(config.errors, ignoreWarnings, disableWarnings, cwd, ts)

    const cachedir = join(
      resolve(cwd, cacheDirectory),
      getCompilerDigest({ version: ts.version, fast, ignoreWarnings, disableWarnings, config, compiler })
    )

    // Make sure the temp cache directory exists.
    mkdirp.sync(cachedir)

    // Render the configuration errors and exit the script.
    if (configDiagnostics.length) {
      throw new TSError(configDiagnostics)
    }

    // Enable `allowJs` when flag is set.
    if (config.options.allowJs) {
      registerExtension('.js', ignore, service)
    }

    // Add all files into the file hash.
    for (const fileName of config.fileNames) {
      if (/\.d\.ts$/.test(fileName)) {
        cache.versions[fileName] = 1
      }
    }

    /**
     * Create the basic required function using transpile mode.
     */
    let getOutput = function (code: string, fileName: string): SourceOutput {
      const result = ts.transpileModule(code, {
        fileName,
        compilerOptions: config.options,
        reportDiagnostics: true
      })

      const diagnosticList = result.diagnostics ?
        formatDiagnostics(result.diagnostics, ignoreWarnings, disableWarnings, cwd, ts) :
        []

      if (diagnosticList.length) {
        throw new TSError(diagnosticList)
      }

      return [result.outputText, result.sourceMapText as string]
    }

    let compile = readThrough(cachedir, shouldCache, getFile, fileExists, cache, getOutput)

    let getTypeInfo = function (fileName: string, position: number): TypeInfo {
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
        getDefaultLibFileName: (options: any) => ts.getDefaultLibFilePath(config.options)
      }

      const service = ts.createLanguageService(serviceHost)

      getOutput = function (code: string, fileName: string) {
        const output = service.getEmitOutput(fileName)

        // Get the relevant diagnostics - this is 3x faster than `getPreEmitDiagnostics`.
        const diagnostics = service.getCompilerOptionsDiagnostics()
          .concat(service.getSyntacticDiagnostics(fileName))
          .concat(service.getSemanticDiagnostics(fileName))

        const diagnosticList = formatDiagnostics(diagnostics, ignoreWarnings, disableWarnings, cwd, ts)

        if (output.emitSkipped) {
          diagnosticList.push(`${relative(cwd, fileName)}: Emit skipped`)
        }

        if (diagnosticList.length) {
          throw new TSError(diagnosticList)
        }

        // Throw an error when requiring `.d.ts` files.
        if (output.outputFiles.length === 0) {
          throw new TypeError(
            'Unable to require `.d.ts` file.\n' +
            'This is usually the result of a faulty configuration or import. ' +
            'Make sure there is a `.js`, `.json` or another executable extension and ' +
            `loader (attached before \`ts-node\`) available alongside \`${fileName}\`.`
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
        function (code: string, fileName: string) {
          addVersion(fileName)
          addCache(code, fileName)

          return getOutput(code, fileName)
        }
      )

      getTypeInfo = function (fileName: string, position: number) {
        addVersion(fileName)

        const info = service.getQuickInfoAtPosition(fileName, position)
        const name = ts.displayPartsToString(info ? info.displayParts : [])
        const comment = ts.displayPartsToString(info ? info.documentation : [])

        return { name, comment }
      }
    }

    return { cwd, compile, getOutput, getTypeInfo }
  }

  function service () {
    return result || (result = load())
  }

  // Eagerly register TypeScript extensions (JavaScript is registered lazily).
  registerExtension('.ts', ignore, service)
  registerExtension('.tsx', ignore, service)

  // Immediately initialize the TypeScript compiler.
  if (!options.lazy) {
    service()
  }

  return service
}

/**
 * Check if the filename should be ignored.
 */
function shouldIgnore (filename: string, service: () => Register, ignore: RegExp[]) {
  const relname = slash(filename)

  return ignore.some(x => x.test(relname))
}

/**
 * Register the extension for node.
 */
function registerExtension (ext: string, ignore: RegExp[], service: () => Register) {
  const old = require.extensions[ext] || require.extensions['.js']

  require.extensions[ext] = function (m: any, filename: string) {
    if (shouldIgnore(filename, service, ignore)) {
      return old(m, filename)
    }

    const _compile = m._compile

    m._compile = function (code: string, fileName: string) {
      return _compile.call(this, service().compile(code, fileName), fileName)
    }

    return old(m, filename)
  }
}

/**
 * Load TypeScript configuration.
 */
function readConfig (compilerOptions: any, project: string | boolean | undefined, cwd: string, ts: TSCommon) {
  const result = loadSync(cwd, typeof project === 'string' ? project : undefined)

  result.config.compilerOptions = extend(
    {
      target: 'es5',
      module: 'commonjs'
    },
    result.config.compilerOptions,
    compilerOptions,
    {
      sourceMap: true,
      inlineSourceMap: false,
      inlineSources: true,
      declaration: false,
      noEmit: false,
      outDir: '$$ts-node$$'
    }
  )

  // Delete options that *should not* be passed through.
  delete result.config.compilerOptions.out
  delete result.config.compilerOptions.outFile
  delete result.config.compilerOptions.declarationDir

  const basePath = result.path ? dirname(result.path) : cwd

  if (typeof ts.parseConfigFile === 'function') {
    return ts.parseConfigFile(result.config, ts.sys, basePath)
  }

  if (typeof ts.parseJsonConfigFileContent === 'function') {
    return ts.parseJsonConfigFileContent(result.config, ts.sys, basePath, null, result.path as string)
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
  compile: (code: string, fileName: string) => SourceOutput
) {
  if (shouldCache === false) {
    return function (code: string, fileName: string) {
      const cachePath = join(cachedir, getCacheName(code, fileName))
      const sourceMapPath = `${cachePath}.js.map`
      const out = compile(code, fileName)

      cache.sourceMaps[fileName] = sourceMapPath

      const output = updateOutput(out[0], fileName, sourceMapPath)
      const sourceMap = updateSourceMap(out[1], fileName)

      writeFileSync(sourceMapPath, sourceMap)

      return output
    }
  }

  return function (code: string, fileName: string) {
    const cachePath = join(cachedir, getCacheName(code, fileName))
    const outputPath = `${cachePath}.js`
    const sourceMapPath = `${cachePath}.js.map`

    cache.sourceMaps[fileName] = sourceMapPath

    // Use the cache when available.
    if (fileExists(outputPath)) {
      return getFile(outputPath)
    }

    const out = compile(code, fileName)

    const output = updateOutput(out[0], fileName, sourceMapPath)
    const sourceMap = updateSourceMap(out[1], fileName)

    writeFileSync(outputPath, output)
    writeFileSync(sourceMapPath, sourceMap)

    return output
  }
}

/**
 * Update the output remapping the source map.
 */
function updateOutput (outputText: string, fileName: string, sourceMapPath: string) {
    // Replace the original extension (E.g. `.ts`).
  const ext = extname(fileName)
  const originalPath = basename(fileName).slice(0, -ext.length) + '.js.map'

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
  return crypto.createHash('sha1')
    .update(extname(fileName), 'utf8')
    .update('\0', 'utf8')
    .update(sourceCode, 'utf8')
    .digest('hex')
}

/**
 * Create a hash of the current configuration.
 */
function getCompilerDigest (opts: any) {
  return crypto.createHash('sha1').update(JSON.stringify(opts), 'utf8').digest('hex')
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
 * Format an array of diagnostics.
 */
function formatDiagnostics (
  diagnostics: TS.Diagnostic[],
  ignore: number[],
  disable: boolean,
  cwd: string,
  ts: TSCommon
) {
  if (disable) {
    return []
  }

  return diagnostics
    .filter(function (diagnostic) {
      return ignore.indexOf(diagnostic.code) === -1
    })
    .map(function (diagnostic) {
      return formatDiagnostic(diagnostic, cwd, ts)
    })
}

/**
 * Format a diagnostic object into a string.
 */
function formatDiagnostic (diagnostic: TS.Diagnostic, cwd: string, ts: TSCommon): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

  if (diagnostic.file) {
    const path = relative(cwd, diagnostic.file.fileName)
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)

    return `${path} (${line + 1},${character + 1}): ${message} (${diagnostic.code})`
  }

  return `${message} (${diagnostic.code})`
}

/**
 * TypeScript diagnostics error.
 */
export class TSError extends BaseError {

  name = 'TSError'
  diagnostics: string[]

  constructor (diagnostics: string[]) {
    super(`⨯ Unable to compile TypeScript\n${diagnostics.join('\n')}`)
    this.diagnostics = diagnostics
  }

}
