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
 * Common TypeScript interfaces between versions.
 */
export interface TS_Common {
  sys: any
  service: any
  ScriptSnapshot: {
    fromString (value: string): any
  }
  displayPartsToString (parts: any): string
  createLanguageService (serviceHost: any): any
  getDefaultLibFilePath (options: any): string
  getPreEmitDiagnostics (program: any): any[]
  flattenDiagnosticMessageText (diagnostic: any, newLine: string): string
}

/**
 * The TypeScript 1.7+ interface.
 */
export interface TS_1_7ish extends TS_Common {
  parseJsonConfigFileContent (config: any, host: any, fileName: string): any
}

/**
 * TypeScript 1.5+ interface.
 */
export interface TS_1_5ish extends TS_Common {
  parseConfigFile (config: any, host: any, fileName: string): any
}

/**
 * TypeScript compatible compilers.
 */
export type TSish = TS_1_5ish | TS_1_7ish

/**
 * Export the current version.
 */
export const VERSION = '0.4.2'

/**
 * Extensions to compile using TypeScript.
 */
export const EXTENSIONS = ['.ts', '.tsx']

/**
 * Registration options.
 */
export interface Options {
  compiler?: string
  noProject?: boolean
  project?: string
  ignoreWarnings?: Array<number | string>
  isEval?: boolean
  disableWarnings?: boolean
  getFile?: (fileName: string) => string
  getVersion?: (fileName: string) => string
}

/**
 * Load TypeScript configuration.
 */
function readConfig (options: Options, cwd: string, ts: TSish) {
  const { project, noProject } = options
  const fileName = noProject ? undefined : tsconfig.resolveSync(project || cwd)

  const config = fileName ? tsconfig.readFileSync(fileName, { filterDefinitions: true }) : {
    files: [],
    compilerOptions: {}
  }

  config.compilerOptions = extend({
    target: 'es5',
    module: 'commonjs'
  }, config.compilerOptions, {
    rootDir: cwd,
    sourceMap: true,
    inlineSourceMap: false,
    inlineSources: false,
    declaration: false
  })

  if (typeof (<TS_1_5ish> ts).parseConfigFile === 'function') {
    return (<TS_1_5ish> ts).parseConfigFile(config, ts.sys, fileName)
  }

  return (<TS_1_7ish> ts).parseJsonConfigFileContent(config, ts.sys, fileName)
}

/**
 * Register TypeScript compiler.
 */
export function register (opts?: Options) {
  const cwd = process.cwd()
  const options = extend({ getFile, getVersion, project: cwd }, opts)

  const files: { [fileName: string]: boolean } = {}

  // Enable compiler overrides.
  options.compiler = options.compiler || 'typescript'
  options.ignoreWarnings = arrify(options.ignoreWarnings).map(Number)

  const ts: TSish = require(options.compiler)
  const config = readConfig(options, cwd, ts)

  // Render the configuration errors and exit the script.
  if (!options.disableWarnings && config.errors.length) {
    const error = new TypeScriptError(formatDiagnostics(config.errors, ts))

    console.error(error.formatMessage())
    process.exit(1)
  }

  const serviceHost = {
    getScriptFileNames: () => config.fileNames.concat(Object.keys(files)),
    getScriptVersion: options.getVersion,
    getScriptSnapshot (fileName: string) {
      const contents = options.getFile(fileName)

      return contents ? ts.ScriptSnapshot.fromString(contents) : undefined
    },
    getNewLine: () => EOL,
    getCurrentDirectory: () => cwd,
    getCompilationSettings: () => config.options,
    getDefaultLibFileName: (options: any) => ts.getDefaultLibFilePath(config.options)
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

    if (output.emitSkipped) {
      throw new TypeScriptError(`${relative(cwd, fileName)}: Emit skipped`)
    }

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

  function addFileName (fileName: string) {
    // Add to the `files` object before compiling - otherwise our file will
    // not found (unless it's in our `tsconfig.json` file).
    files[fileName] = true
  }

  function compile (fileName: string) {
    try {
      addFileName(fileName)
      validateDiagnostics(service, fileName, options, ts)
      return getOutput(fileName)
    } catch (error) {
      if (error.name === 'TypeScriptError' && !options.isEval) {
        console.error(error.formatMessage())
        process.exit(1)
      }

      throw error
    }
  }

  function loader (m: any, fileName: string) {
    return m._compile(compile(fileName), fileName)
  }

  function getTypeInfo (fileName: string, position: number) {
    addFileName(fileName)

    const info = service.getQuickInfoAtPosition(fileName, position)
    const name = ts.displayPartsToString(info ? info.displayParts : [])
    const comment = ts.displayPartsToString(info ? info.documentation : [])

    return chalk.bold(name) + (comment ? `\n${comment}` : '')
  }

  // Attach the loader to each defined extension.
  EXTENSIONS.forEach(function (extension) {
    require.extensions[extension] = loader
  })

  return { compile, getTypeInfo }
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
export function validateDiagnostics (service: any, fileName: string, options: Options, ts: TSish) {
  const diagnostics = ts.getPreEmitDiagnostics(service.getProgram())
    .filter(function (diagnostic) {
      return options.ignoreWarnings.indexOf(diagnostic.code) === -1
    })

  if (!options.disableWarnings && diagnostics.length) {
    const message = formatDiagnostics(diagnostics, ts)

    throw new TypeScriptError(message)
  }
}

/**
 * Format a diagnostic object into a string.
 */
export function formatDiagnostic (diagnostic: any, ts: TSish, cwd: string = '.'): string {
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
function formatDiagnostics (diagnostics: any[], ts: TSish) {
  return diagnostics.map(d => formatDiagnostic(d, ts)).join(EOL)
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

  formatMessage () {
    const boundary = chalk.grey('----------------------------------')

    return [
      boundary,
      chalk.red.bold('⨯ Unable to compile TypeScript'),
      '',
      this.message,
      boundary
    ].join(EOL)
  }

}
