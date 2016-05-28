import { relative, resolve, dirname } from 'path'
import { readFileSync, statSync } from 'fs'
import { EOL } from 'os'
import sourceMapSupport = require('source-map-support')
import extend = require('xtend')
import arrify = require('arrify')
import { BaseError } from 'make-error'
import * as TS from 'typescript'

const pkg = require('../package.json')

/**
 * Common TypeScript interfaces between versions.
 */
export interface TSCommon {
  sys: any
  ScriptSnapshot: typeof TS.ScriptSnapshot
  displayPartsToString: typeof TS.displayPartsToString
  createLanguageService: typeof TS.createLanguageService
  getDefaultLibFilePath: typeof TS.getDefaultLibFilePath
  getPreEmitDiagnostics: typeof TS.getPreEmitDiagnostics
  flattenDiagnosticMessageText: typeof TS.flattenDiagnosticMessageText

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
 * Extensions to compile using TypeScript.
 */
export const EXTENSIONS = ['.ts', '.tsx']

/**
 * Registration options.
 */
export interface Options {
  compiler?: string
  noProject?: boolean
  configFileName?: string
  project?: string
  ignoreWarnings?: Array<number | string>
  disableWarnings?: boolean
  getFile?: (fileName: string) => string
  getVersion?: (fileName: string) => string
}

/**
 * Load TypeScript configuration.
 */
function readConfig (options: Options, cwd: string, ts: TSCommon) {
  const { project, noProject, configFileName } = options
  const fileName = configFileName || (noProject ? undefined : ts.findConfigFile(project || cwd, ts.sys.fileExists))

  const result = fileName ? ts.readConfigFile(fileName, ts.sys.readFile) : {
    config: {
      files: [],
      compilerOptions: {}
    }
  }

  if (result.error) {
    throw new TSError([formatDiagnostic(result.error, ts)])
  }

  result.config.compilerOptions = extend(
    {
      target: 'es5',
      module: 'commonjs'
    },
    result.config.compilerOptions,
    {
      sourceMap: false,
      inlineSourceMap: true,
      inlineSources: true,
      declaration: false,
      noEmit: false
    }
  )

  // Resolve before getting `dirname` to work around Microsoft/TypeScript#2965
  const basePath = fileName ? dirname(resolve(fileName)) : cwd

  if (typeof ts.parseConfigFile === 'function') {
    return ts.parseConfigFile(result.config, ts.sys, basePath)
  }

  return ts.parseJsonConfigFileContent(result.config, ts.sys, basePath, null, fileName)
}

/**
 * Track the project information.
 */
interface Project {
  files: { [fileName: string]: boolean }
  versions: { [fileName: string]: string }
  version: number
}

/**
 * Default register options.
 */
const DEFAULT_OPTIONS: Options = {
  getFile,
  getVersion,
  disableWarnings: process.env.TS_NODE_DISABLE_WARNINGS,
  compiler: process.env.TS_NODE_COMPILER,
  project: process.env.TS_NODE_PROJECT || process.cwd(),
  noProject: process.env.TS_NODE_NO_PROJECT,
  ignoreWarnings: process.env.TS_NODE_IGNORE_WARNINGS
}

/**
 * Register TypeScript compiler.
 */
export function register (opts?: Options) {
  const cwd = process.cwd()
  const options = extend(DEFAULT_OPTIONS, opts)
  const project: Project = { version: 0, files: {}, versions: {} }

  // Enable compiler overrides.
  options.compiler = options.compiler || 'typescript'
  options.ignoreWarnings = arrify(options.ignoreWarnings).map(Number)

  const ts: typeof TS = require(options.compiler)
  const config = readConfig(options, cwd, ts)

  // Render the configuration errors and exit the script.
  if (!options.disableWarnings && config.errors.length) {
    throw new TSError(config.errors.map((d: any) => formatDiagnostic(d, ts)))
  }

  // Add all files into the file hash.
  for (const fileName of config.fileNames) {
    project.files[fileName] = true
  }

  const serviceHost = {
    getScriptFileNames: () => Object.keys(project.files),
    getProjectVersion: () => String(project.version),
    getScriptVersion: (fileName: string) => incrementFile(fileName),
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
    environment: 'node',
    retrieveFile (fileName: string) {
      if (project.files[fileName]) {
        return getOutput(fileName)
      }
    }
  } as any)

  function incrementAndAddFile (fileName: string) {
    // Add files to the hash before compilation.
    project.files[fileName] = true

    const currentVersion = project.versions[fileName]
    const newVersion = incrementFile(fileName)

    // Increment the project version for file changes.
    if (currentVersion !== newVersion) {
      project.version++
    }

    return newVersion
  }

  function incrementFile (fileName: string) {
    const version = options.getVersion(fileName)
    project.versions[fileName] = version
    return version
  }

  function getOutput (fileName: string) {
    const output = service.getEmitOutput(fileName)
    const diagnostics = getDiagnostics(service, fileName, options, ts)

    if (output.emitSkipped) {
      diagnostics.push(`${relative(cwd, fileName)}: Emit skipped`)
    }

    if (diagnostics.length) {
      throw new TSError(diagnostics)
    }

    return output.outputFiles[0].text
  }

  function compile (fileName: string) {
    incrementAndAddFile(fileName)

    return getOutput(fileName)
  }

  function loader (m: any, fileName: string) {
    incrementAndAddFile(fileName)

    return m._compile(getOutput(fileName), fileName)
  }

  function getTypeInfo (fileName: string, position: number) {
    incrementAndAddFile(fileName)

    const info = service.getQuickInfoAtPosition(fileName, position)
    const name = ts.displayPartsToString(info ? info.displayParts : [])
    const comment = ts.displayPartsToString(info ? info.documentation : [])

    return { name, comment }
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
  } catch (error) {
    return
  }
}

/**
 * Get file diagnostics from a TypeScript language service.
 */
function getDiagnostics (service: any, fileName: string, options: Options, ts: TSCommon) {
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
function formatDiagnostic (diagnostic: any, ts: TSCommon, cwd: string = '.'): string {
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
