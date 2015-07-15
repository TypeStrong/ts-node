import * as TS from 'typescript'
import * as tsconfig from 'tsconfig'
import { resolve, relative } from 'path'
import * as fs from 'fs'
import { EOL } from 'os'
import sourceMapSupport = require('source-map-support')
import extend = require('xtend')
import arrify = require('arrify')

const cwd = process.cwd()
const readFileSync = fs.readFileSync

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
    module: 'commonjs'
  })

  return ts.parseConfigFile(config, ts.sys, fileName)
}

/**
 * Register TypeScript compiler.
 */
export function register (opts?: Options) {
  const options = extend(opts)

  const maps: { [fileName: string]: string } = {}
  const files: { [fileName: string]: boolean } = {}

  // Enable compiler overrides.
  options.compiler = options.compiler || 'typescript'

  // Ensure `ignoreWarnings` is always an array.
  options.ignoreWarnings = arrify(options.ignoreWarnings)

  // Resolve configuration file options.
  options.configFile = options.configFile ?
    resolve(cwd, options.configFile) :
    tsconfig.resolveSync(cwd)

  const ts: typeof TS = require(options.compiler)
  const config = readConfig(options.configFile, ts)

  if (config.errors.length) {
    throw createError(config.errors, ts)
  }

  const serviceHost: TS.LanguageServiceHost = {
    getScriptFileNames: () => config.fileNames.concat(Object.keys(files)),
    getScriptVersion: (fileName) => 'node',
    getScriptSnapshot (fileName): TS.IScriptSnapshot {
      try {
        return ts.ScriptSnapshot.fromString(readFileSync(fileName, 'utf-8'))
      } catch (e) {
        return
      }
    },
    getCurrentDirectory: () => cwd,
    getScriptIsOpen: () => true,
    getCompilationSettings: () => config.options,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(config.options)
  }

  const registry = ts.createDocumentRegistry()
  const service = ts.createLanguageService(serviceHost, registry)
  const hasSourceMap = config.options.sourceMap

  const retrieveSourceMap = sourceMapSupport.retrieveSourceMap

  // Install source map support and read from cache.
  sourceMapSupport.install({
    handleUncaughtExceptions: false,
    retrieveSourceMap (filename: string) {
      var map = maps && maps[filename]

      if (map) {
        return <sourceMapSupport.UrlAndMap> { map, url: null }
      }

      return retrieveSourceMap(filename)
    }
  })

  function compile (fileName: string) {
    files[fileName] = true

    const output = service.getEmitOutput(fileName)
    const result = output.outputFiles[hasSourceMap ? 1 : 0].text

    // Cache source maps where provided.
    if (hasSourceMap) {
      maps[output.outputFiles[0].name] = output.outputFiles[0].text
    }

    // Log all diagnostics before exiting the program.
    const diagnostics = getDiagnostics(service, fileName, options)

    if (diagnostics.length) {
      throw createError(diagnostics, ts)
    }

    return result
  }

  function loader (m: any, fileName: string) {
    return m._compile(compile(fileName), fileName)
  }

  // Attach the loader to each defined extension.
  EXTENSIONS.forEach(function (extension) {
    require.extensions[extension] = loader
  })

  return {
    registry,
    ts,
    config,
    options
  }
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
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)

    return `${relative(cwd, diagnostic.file.fileName)} (${line + 1},${character + 1}): ${message} (${diagnostic.code})`
  }

  return `${message} (${diagnostic.code})`
}

/**
 * Create a "TypeScript" error.
 */
export function createError (diagnostics: TS.Diagnostic[], ts: typeof TS): Error {
  const message = ['Unable to compile TypeScript:']
    .concat(diagnostics.map((d) => formatDiagnostic(d, ts)))
    .join(EOL)

  const err = new Error(message)
  err.name = 'TypeScriptError'
  return err
}

/**
 * Generate an base 64 inline source map.
 */
export function getInlineSourceMap (map: string, fileName: string, code: string): string {
  var sourceMap = JSON.parse(map)
  sourceMap.file = fileName
  sourceMap.sources = [fileName]
  sourceMap.sourcesContent = [code]
  delete sourceMap.sourceRoot
  const inlineSourceMap = new Buffer(JSON.stringify(sourceMap)).toString('base64')
  return 'data:application/json;base64,' + inlineSourceMap
}
