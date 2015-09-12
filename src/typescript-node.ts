import * as TS from 'typescript'
import tsconfig = require('tsconfig')
import { resolve, relative, extname, basename, isAbsolute } from 'path'
import { readFileSync, statSync } from 'fs'
import { EOL } from 'os'
import { BaseError } from 'make-error'
import sourceMapSupport = require('source-map-support')
import extend = require('xtend')
import arrify = require('arrify')
import chalk = require('chalk')

/**
 * Export the current version.
 */
export const VERSION = '0.1.1'

/**
 * Extensions to compile using TypeScript.
 */
export const EXTENSIONS = ['.ts', '.tsx']

/**
 * Registration options.
 */
export interface Options {
  compiler?: string
  configFile?: string
  ignoreWarnings?: string[]
  isEval?: boolean
  getFile?: (fileName: string) => string
  getVersion?: (fileName: string) => string
}

/**
 * Load TypeScript configuration.
 */
function readConfig (fileName: string, ts: typeof TS) {
  const config = fileName ? tsconfig.readFileSync(fileName) : {
    files: [],
    compilerOptions: {}
  }

  config.compilerOptions = extend({
    target: 'es5'
  }, config.compilerOptions, {
    module: 'commonjs',
    sourceMap: true,
    inlineSourceMap: false,
    inlineSources: false,
    declaration: false
  })

  return ts.parseConfigFile(config, ts.sys, fileName)
}

/**
 * Register TypeScript compiler.
 */
export function register (opts?: Options) {
  const cwd = process.cwd()
  const options = extend({ getFile, getVersion, isEval: false }, opts)

  const files: { [fileName: string]: boolean } = {}

  // Enable compiler overrides.
  options.compiler = options.compiler || 'typescript'
  options.ignoreWarnings = arrify(options.ignoreWarnings)

  // Resolve configuration file options.
  options.configFile = options.configFile ?
    resolve(cwd, options.configFile) :
    tsconfig.resolveSync(cwd)

  const ts: typeof TS = require(options.compiler)
  const config = readConfig(options.configFile, ts)

  // Render the configuration errors and exit the script.
  if (config.errors.length) {
    console.error(formatDiagnostics(config.errors, ts))
    process.exit(1)
  }

  const serviceHost: TS.LanguageServiceHost = {
    getScriptFileNames: () => config.fileNames.concat(Object.keys(files)),
    getScriptVersion: options.getVersion,
    getScriptSnapshot (fileName): TS.IScriptSnapshot {
      const contents = options.getFile(fileName)

      return contents ? ts.ScriptSnapshot.fromString(contents) : undefined
    },
    getNewLine: () => EOL,
    getCurrentDirectory: () => cwd,
    getCompilationSettings: () => config.options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(config.options)
  }

  const service = ts.createLanguageService(serviceHost)

  // Install source map support and read from cache.
  sourceMapSupport.install({
    retrieveFile (fileName) {
      if (files[fileName]) {
        return getOutput(fileName)
      }
    }
  })

  function getOutput (fileName: string) {
    const output = service.getEmitOutput(fileName)
    const result = output.outputFiles[1].text
    const sourceText = service.getSourceFile(fileName).text
    const sourceMapText = output.outputFiles[0].text
    const sourceMapFileName = output.outputFiles[0].name
    const sourceMap = getSourceMap(sourceMapText, fileName, sourceText)
    const base64SourceMapText = new Buffer(sourceMap).toString('base64')

    return result
      .replace(
        '//# sourceMappingURL=' + basename(sourceMapFileName),
        `//# sourceMappingURL=data:application/json;base64,${base64SourceMapText}`
      )
  }

  function compile (fileName: string) {
    // Add to the `files` object before compiling - otherwise our file will
    // not found (unless it's in our `tsconfig.json` file).
    files[fileName] = true

    const diagnostics = getDiagnostics(service, fileName, options)

    if (diagnostics.length) {
      const message = formatDiagnostics(diagnostics, ts)

      if (opts.isEval) {
        throw new TypeScriptError(message)
      }

      console.error(message)
      process.exit(1)
    }

    return getOutput(fileName)
  }

  function loader (m: any, fileName: string) {
    return m._compile(compile(fileName), fileName)
  }

  // Attach the loader to each defined extension.
  EXTENSIONS.forEach(function (extension) {
    require.extensions[extension] = loader
  })

  return compile
}

/**
 * Get the file version using the mod time.
 */
export function getVersion (fileName: string): string {
  return String(statSync(fileName).mtime.getTime())
}

/**
 * Get the file from the file system.
 */
export function getFile (fileName: string): string {
  try {
    return readFileSync(fileName, 'utf8')
  } catch (err) {}
}

/**
 * Get file diagnostics from a TypeScript language service.
 */
export function getDiagnostics (service: TS.LanguageService, fileName: string, options: Options) {
  return service.getCompilerOptionsDiagnostics()
    .concat(service.getSyntacticDiagnostics(fileName))
    .concat(service.getSemanticDiagnostics(fileName))
    .filter(function (diagnostic) {
      return options.ignoreWarnings.indexOf(String(diagnostic.code)) === -1
    })
}

/**
 * Format a diagnostic object into a string.
 */
export function formatDiagnostic (diagnostic: TS.Diagnostic, ts: typeof TS, cwd: string = '.'): string {
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

  if (diagnostic.file) {
    const path = relative(cwd, diagnostic.file.fileName)
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)

    return `${path} (${line + 1},${character + 1}): ${message} (${diagnostic.code})`
  }

  return `${message} (${diagnostic.code})`
}

/**
 * Format diagnostics into friendlier errors.
 */
function formatDiagnostics (diagnostics: TS.Diagnostic[], ts: typeof TS) {
  const boundary = chalk.grey('----------------------------------')

  return [
    boundary,
    chalk.red.bold('⨯ Unable to compile TypeScript'),
    '',
    diagnostics.map(d => formatDiagnostic(d, ts)).join(EOL),
    boundary
  ].join(EOL)
}

/**
 * Sanitize the source map content.
 */
export function getSourceMap (map: string, fileName: string, code: string): string {
  var sourceMap = JSON.parse(map)
  sourceMap.file = fileName
  sourceMap.sources = [fileName]
  sourceMap.sourcesContent = [code]
  delete sourceMap.sourceRoot
  return JSON.stringify(sourceMap)
}

/**
 * Extend errors with TypeScript error instances.
 */
export class TypeScriptError extends BaseError {

  name = 'TypeScriptError'

}
