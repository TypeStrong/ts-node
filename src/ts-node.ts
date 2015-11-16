import tsconfig = require('tsconfig')
import { resolve, relative, extname, basename, isAbsolute } from 'path'
import { readFileSync, statSync } from 'fs'
import { EOL } from 'os'
import sourceMapSupport = require('source-map-support')
import extend = require('xtend')
import arrify = require('arrify')
import chalk = require('chalk')
import { BaseError } from 'make-error'

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
export const VERSION = '0.5.2'

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
    const diagnostics = config.errors.map((d: any) => formatDiagnostic(d, ts))

    console.error(printDiagnostics(diagnostics))
    process.exit(1)
  }

  // Add all files into the file hash.
  for (const fileName of config.fileNames) {
    files[fileName] = true
  }

  const serviceHost = {
    getScriptFileNames: () => Object.keys(files),
    getScriptVersion: options.getVersion,
    getScriptSnapshot (fileName: string) {
      const contents = options.getFile(fileName)

      return contents == null ? undefined : ts.ScriptSnapshot.fromString(contents)
    },
    getNewLine: () => EOL,
    getCurrentDirectory: () => cwd,
    getCompilationSettings: () => config.options,
    getDefaultLibFileName: (options: any) => ts.getDefaultLibFilePath(config.options)
  }

  const service = ts.createLanguageService(serviceHost)

  // Install source map support and read from cache.
  sourceMapSupport.install({
    retrieveSourceMap (fileName) {
      if (files[fileName]) {
        return {
          url: fileName,
          map: retrieveSourceMap(fileName)
        }
      }
    }
  })

  function retrieveSourceMap (fileName: string) {
    const output = service.getEmitOutput(fileName)
    const sourceText = service.getSourceFile(fileName).text
    const sourceMap = output.outputFiles[0].text

    return getSourceMap(sourceMap, fileName, sourceText)
  }

  function addFileName (fileName: string) {
    // Add to the `files` object before compiling - otherwise our file will
    // not found (unless it's in our `tsconfig.json` file).
    files[fileName] = true
  }

  function compile (fileName: string) {
    addFileName(fileName)

    const output = service.getEmitOutput(fileName)
    const diagnostics = getDiagnostics(service, fileName, options, ts)

    if (output.emitSkipped) {
      diagnostics.push(`${relative(cwd, fileName)}: Emit skipped`)
    }

    if (diagnostics.length) {
      if (options.isEval) {
        throw new TSError(diagnostics)
      } else {
        console.error(printDiagnostics(diagnostics))
        process.exit(1)
      }
    }

    return output.outputFiles[1].text
  }

  function loader (m: any, fileName: string) {
    return m._compile(compile(fileName), fileName)
  }

  function getTypeInfo (fileName: string, position: number) {
    addFileName(fileName)

    const info = service.getQuickInfoAtPosition(fileName, position)
    const name = ts.displayPartsToString(info ? info.displayParts : [])
    const comment = ts.displayPartsToString(info ? info.documentation : [])

    return chalk.bold(name) + (comment ? `${EOL}${comment}` : '')
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
function getDiagnostics (service: any, fileName: string, options: Options, ts: TSish) {
  if (options.disableWarnings) {
    return []
  }

  return ts.getPreEmitDiagnostics(service.getProgram())
    .filter(function (diagnostic) {
      return options.ignoreWarnings.indexOf(diagnostic.code) === -1
    })
    .map(function (diagnostic) {
      return formatDiagnostic(diagnostic, ts)
    })
}

/**
 * Format a diagnostic object into a string.
 */
function formatDiagnostic (diagnostic: any, ts: TSish, cwd: string = '.'): string {
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
export function printDiagnostics (diagnostics: string[]) {
  const boundary = chalk.grey('----------------------------------')

  return [
    boundary,
    chalk.red.bold('⨯ Unable to compile TypeScript'),
    '',
    diagnostics.join(EOL),
    boundary
  ].join(EOL)
}

/**
 * Sanitize the source map content.
 */
function getSourceMap (map: string, fileName: string, code: string): string {
  var sourceMap = JSON.parse(map)
  sourceMap.file = fileName
  sourceMap.sources = [fileName]
  sourceMap.sourcesContent = [code]
  delete sourceMap.sourceRoot
  return JSON.stringify(sourceMap)
}

/**
 * TypeScript diagnostics error.
 */
export class TSError extends BaseError {

  name = 'TSError'

  constructor (public diagnostics: string[]) {
    super('Unable to compile TypeScript')
  }

  print () {
    return printDiagnostics(this.diagnostics)
  }

}
