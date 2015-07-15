import { resolve } from 'path'
import { Command } from 'commander'
import { start } from 'repl'
import { inspect } from 'util'
import { LanguageService, LanguageServiceHost } from 'typescript'
import { readFileSync } from 'fs'
import Module = require('module')
import extend = require('xtend')
import { runInThisContext } from 'vm'
import { register, createError, getInlineSourceMap, getDiagnostics } from '../typescript-node'

var program = new Command('ts-node')
var pkg = require('../../package.json')

program.option('-e, --eval [code]', 'Evaluate code')
program.option('-p, --print [code]', 'Evaluate code and print result')
program.option('--compiler [name]', 'Specify a custom TypeScript compiler')
program.option('--ignoreWarnings [codes]', 'Specify a custom TypeScript compiler', list)
program.option('--configFile [path]', 'Specify a custom TypeScript compiler')

program.version(pkg.version)
program.usage('[options] [ -e script | script.js ] [arguments]')
program.parse(process.argv)

// TypeScript files must always end with `.ts`.
const EVAL_FILENAME = '[eval].ts'

const cwd = process.cwd()
const opts = program.opts()
const print = opts.print
const eval = opts.eval
const code: string = eval == null ? print : eval

// Register returns environment options, helps creating a new language service.
const compiler = register(opts)

// Defer creation of eval services.
let files: { [filename: string]: { text: string, version: number } }
let service: LanguageService

if (typeof code === 'string') {
  createService()

  global.__filename = EVAL_FILENAME
  global.__dirname = cwd

  const module = new Module(global.__filename)
  module.filename = global.__filename
  module.paths = Module._nodeModulePaths(global.__dirname)

  global.exports = module.exports
  global.module = module
  global.require = module.require.bind(module)

  var result = _eval(code, global.__filename)

  if (print != null) {
    var output = typeof result === 'string' ? result : inspect(result)
    process.stdout.write(output + '\n')
  }
} else {
  if (program.args.length) {
    let index = 2
    let skip = false

    // Skip over TS configuration options.
    for (; index < process.argv.length; index++) {
      if (skip) {
        skip = false
        continue
      }

      const arg = process.argv[index]

      // Break on unknown argument value.
      if (arg.charAt(0) === '-') {
        const value = opts[arg.substr(2)]

        if (value && value !== true) {
          skip = true
        }

        continue
      }

      break
    }

    const args = process.argv.slice(index)

    // Make the filename absolute.
    args[0] = resolve(args[0])

    process.argv = ['node'].concat(args)
    process.execArgv.unshift(__filename)

    Module.runMain()
  } else {
    createService()
    startRepl()
  }
}

/**
 * Evaluate the code snippet.
 */
function _eval (text: string, filename: string) {
  if (!files[filename]) {
    files[filename] = { version: 0, text: '' }
  }

  const file = files[filename]

  file.text = text
  file.version++

  const output = service.getEmitOutput(filename)
  const diagnostics = getDiagnostics(service, filename, compiler.options)

  if (diagnostics.length) {
    throw createError(diagnostics, compiler.ts)
  }

  const result = output.outputFiles[1].text
  const sourceMap = output.outputFiles[0].text

  const code = result.replace(
    '//# sourceMappingURL=' + filename.replace(/\.ts$/, '.js.map'),
    '//# sourceMappingURL=' + getInlineSourceMap(sourceMap, filename, text)
  )

  return runInThisContext(result, filename)
}

/**
 * Create an inline eval service on demand.
 */
function createService () {
  const { ts, registry, config } = compiler

  // Initialize files object.
  files = {}

  // Create language services for `eval`.
  service = ts.createLanguageService(<LanguageServiceHost> {
    getScriptFileNames: () => {
      return config.fileNames.concat(Object.keys(files))
    },
    getScriptVersion: (fileName) => files[fileName] && files[fileName].version.toString(),
    getScriptSnapshot (fileName) {
      const file = files[fileName]

      if (file) {
        return ts.ScriptSnapshot.fromString(file.text)
      }

      try {
        return ts.ScriptSnapshot.fromString(readFileSync(fileName, 'utf-8'))
      } catch (e) {
        return
      }
    },
    getCurrentDirectory: () => cwd,
    getScriptIsOpen: () => true,
    getCompilationSettings: () => extend(config.options, { sourceMap: true }),
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options)
  }, registry)
}

/**
 * Start a CLI REPL.
 */
function startRepl () {
  return start({
    prompt: '> ',
    input: process.stdin,
    output: process.stdout,
    eval: replEval,
    useGlobal: true
  })
}

/**
 * Eval code from the REPL.
 */
function replEval (code: string, context: any, filename: string, callback: (err: Error, result: any) => any) {
  let err: Error
  let result: any

  try {
    result = _eval(code, EVAL_FILENAME)
  } catch (e) {
    err = e
  }

  callback(err, result)
}

/**
 * Split a string of values into an array.
 */
function list (value: string) {
  return value.split(/ *, */)
}
