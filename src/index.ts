import { relative, basename, resolve, dirname, sep, join } from 'path'
import { readFileSync, statSync } from 'fs'
import { EOL } from 'os'
import sourceMapSupport = require('source-map-support')
import extend = require('xtend')
import arrify = require('arrify')
import { BaseError } from 'make-error'
import * as TS from 'typescript'

const pkg = require('../package.json')
const oldHandlers: { [key: string]: any } = {}

/**
 * Common TypeScript interfaces between versions.
 */
export interface TSCommon {
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
  fast?: boolean
  lazy?: boolean
  compiler?: string
  project?: string
  ignoreWarnings?: Array<number | string>
  disableWarnings?: boolean
  getFile?: (fileName: string) => string
  getVersion?: (fileName: string) => string
  fileExists?: (fileName: string) => boolean
  compilerOptions?: any
}

/**
 * Load TypeScript configuration.
 */
function readConfig (options: Options, cwd: string, ts: TSCommon) {
  let project: string

  if (options.project == null) {
    const path = ts.findConfigFile(cwd, options.fileExists)

    project = path ? resolve(path) : undefined
  } else if (typeof options.project === 'string') {
    const path = resolve(options.project)

    if (options.fileExists(path)) {
      project = path
    } else {
      project = join(path, 'tsconfig.json')
    }
  }

  const result = project ? ts.readConfigFile(project, options.getFile) : {
    config: {
      files: [],
      compilerOptions: {}
    }
  }

  if (result.error) {
    throw new TSError([formatDiagnostic(result.error, cwd, ts)])
  }

  result.config.compilerOptions = extend(
    {
      target: 'es5',
      module: 'commonjs'
    },
    result.config.compilerOptions,
    options.compilerOptions,
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

  const basePath = project ? dirname(project) : cwd

  if (typeof ts.parseConfigFile === 'function') {
    return ts.parseConfigFile(result.config, ts.sys, basePath)
  }

  return ts.parseJsonConfigFileContent(result.config, ts.sys, basePath, null, project)
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
 * Information retrieved from type info check.
 */
export interface TypeInfo {
  name: string
  comment: string
}

/**
 * Default register options.
 */
const DEFAULT_OPTIONS: Options = {
  getFile,
  getVersion,
  fileExists,
  disableWarnings: process.env.TS_NODE_DISABLE_WARNINGS,
  compiler: process.env.TS_NODE_COMPILER,
  project: process.env.TS_NODE_PROJECT,
  ignoreWarnings: process.env.TS_NODE_IGNORE_WARNINGS,
  fast: process.env.TS_NODE_FAST
}

export interface Register {
  cwd: string
  compile (fileName: string): string
  getOutput (fileName: string): string
  getTypeInfo (fileName: string, position: number): { name: string, comment: string }
}

/**
 * Register TypeScript compiler.
 */
export function register (opts?: Options): () => Register {
  const options = extend(DEFAULT_OPTIONS, opts)
  let result: Register

  // Enable compiler overrides.
  options.compiler = options.compiler || 'typescript'
  options.ignoreWarnings = arrify(options.ignoreWarnings).map(Number)

  // Parse compiler options as JSON.
  options.compilerOptions = typeof options.compilerOptions === 'string' ?
    JSON.parse(options.compilerOptions) :
    options.compilerOptions

  function load () {
    const project: Project = { version: 0, files: {}, versions: {} }

    // Install source map support and read from cache.
    sourceMapSupport.install({
      environment: 'node',
      retrieveFile (fileName: string) {
        if (project.files[fileName]) {
          return getOutput(fileName)
        }
      }
    } as any)

    // Require the TypeScript compiler and configuration.
    const cwd = process.cwd()
    const ts: typeof TS = require(options.compiler)
    const config = readConfig(options, cwd, ts)
    const diagnostics = formatDiagnostics(config.errors, options, cwd, ts)

    // Render the configuration errors and exit the script.
    if (diagnostics.length) {
      throw new TSError(diagnostics)
    }

    // Enable `allowJs` when flag is set.
    if (config.options.allowJs) {
      registerExtension('.js')
    }

    // Add all files into the file hash.
    for (const fileName of config.fileNames) {
      project.files[fileName] = true
    }

    /**
     * Create the basic required function using transpile mode.
     */
    let getOutput = function (fileName: string) {
      const contents = options.getFile(fileName)
      const { outputText, diagnostics } = ts.transpileModule(contents, {
        fileName,
        compilerOptions: config.options,
        reportDiagnostics: true
      })

      const diagnosticList = diagnostics ? formatDiagnostics(diagnostics, options, cwd, ts) : []

      if (diagnosticList.length) {
        throw new TSError(diagnosticList)
      }

      return outputText
    }

    let compile = function (fileName: string) {
      return getOutput(fileName)
    }

    let getTypeInfo = function (fileName: string, position: number): TypeInfo {
      throw new TypeError(`No type information available under "--fast" mode`)
    }

    /**
     * Use language services when the fast option is disabled.
     */
    if (!options.fast) {
      const serviceHost = {
        getScriptFileNames: () => Object.keys(project.files),
        getProjectVersion: () => String(project.version),
        getScriptVersion: (fileName: string) => versionFile(fileName),
        getScriptSnapshot (fileName: string) {
          if (!options.fileExists(fileName)) {
            return undefined
          }

          return ts.ScriptSnapshot.fromString(options.getFile(fileName))
        },
        getNewLine: () => EOL,
        getCurrentDirectory: () => cwd,
        getCompilationSettings: () => config.options,
        getDefaultLibFileName: (options: any) => ts.getDefaultLibFilePath(config.options)
      }

      const service = ts.createLanguageService(serviceHost)

      const addAndVersionFile = function (fileName: string) {
        // Add files to the hash before compilation.
        project.files[fileName] = true

        const currentVersion = project.versions[fileName]
        const newVersion = versionFile(fileName)

        // Increment the project version for file changes.
        if (currentVersion !== newVersion) {
          project.version++
        }

        return newVersion
      }

      const versionFile = function (fileName: string) {
        const version = options.getVersion(fileName)
        project.versions[fileName] = version
        return version
      }

      getOutput = function (fileName: string) {
        const output = service.getEmitOutput(fileName)

        // Get the relevant diagnostics - this is 3x faster than `getPreEmitDiagnostics`.
        const diagnostics = service.getCompilerOptionsDiagnostics()
          .concat(service.getSyntacticDiagnostics(fileName))
          .concat(service.getSemanticDiagnostics(fileName))

        const diagnosticList = formatDiagnostics(diagnostics, options, cwd, ts)

        if (output.emitSkipped) {
          diagnosticList.push(`${relative(process.cwd(), fileName)}: Emit skipped`)
        }

        if (diagnosticList.length) {
          throw new TSError(diagnosticList)
        }

        const result = output.outputFiles[1].text
        const sourceMapText = output.outputFiles[0].text
        const sourceMapFileName = output.outputFiles[0].name
        const sourceMap = updateSourceMap(sourceMapText, fileName)
        const base64SourceMapText = new Buffer(sourceMap).toString('base64')

        return result
          .replace(
            '//# sourceMappingURL=' + basename(sourceMapFileName),
            `//# sourceMappingURL=data:application/json;base64,${base64SourceMapText}`
          )
      }

      compile = function (fileName: string) {
        addAndVersionFile(fileName)

        return getOutput(fileName)
      }

      getTypeInfo = function (fileName: string, position: number) {
        addAndVersionFile(fileName)

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

  function loader (m: any, fileName: string) {
    return m._compile(service().compile(fileName), fileName)
  }

  function shouldIgnore (filename: string) {
    return relative(service().cwd, filename).split(sep).indexOf('node_modules') > -1
  }

  function registerExtension (ext: string) {
    const old = oldHandlers[ext] || oldHandlers['.js'] || require.extensions['.js']

    oldHandlers[ext] = require.extensions[ext]

    require.extensions[ext] = function (m: any, filename: string) {
      if (shouldIgnore(filename)) {
        return old(m, filename)
      }

      return loader(m, filename)
    }
  }

  // Eagerly register TypeScript extensions (JavaScript is registered lazily).
  registerExtension('.ts')
  registerExtension('.tsx')

  // Immediately initialize the TypeScript compiler.
  if (!options.lazy) {
    service()
  }

  return service
}

/**
 * Sanitize the source map content.
 */
function updateSourceMap (map: string, fileName: string): string {
  const sourceMap = JSON.parse(map)
  sourceMap.file = fileName
  sourceMap.sources = [fileName]
  delete sourceMap.sourceRoot
  return JSON.stringify(sourceMap)
}

/**
 * Get the file version using the mod time.
 */
export function getVersion (fileName: string): string {
  return String(statSync(fileName).mtime.getTime())
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
 * Format an array of diagnostics.
 */
function formatDiagnostics (diagnostics: TS.Diagnostic[], options: Options, cwd: string, ts: TSCommon) {
  if (options.disableWarnings) {
    return []
  }

  return diagnostics
    .filter(function (diagnostic) {
      return options.ignoreWarnings.indexOf(diagnostic.code) === -1
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
