import { join } from 'path'
import { start } from 'repl'
import { inspect } from 'util'
import { readFileSync } from 'fs'
import Module = require('module')
import extend = require('xtend')
import minimist = require('minimist')
import { register, VERSION, TypeScriptError, getFile, getVersion } from '../typescript-node'

interface Argv {
  eval?: string
  print?: string
  version?: boolean
  help?: boolean
  compiler: string
  configFile: string
  ignoreWarnings: string
  _: string[]
}

const argv = <Argv> <any> minimist(process.argv.slice(2), {
  stopEarly: true,
  string: ['eval', 'print', 'compiler', 'configFile', 'ignoreWarnings'],
  boolean: ['help', 'version'],
  alias: {
    v: ['version'],
    e: ['eval'],
    p: ['print'],
    c: ['compiler'],
    f: ['configFile'],
    i: ['ignoreWarnings']
  }
})

if (argv.version) {
  console.log(VERSION)
  process.exit(0)
}

if (argv.help) {
  console.log(`
  Usage: ts-node [options] [ -e script | script.ts ] [arguments]

  Options:

    -e, --eval [code]             Evaluate code
    -p, --print [code]            Evaluate code and print result
    -c, --compiler [name]         Specify a custom TypeScript compiler
    -i, --ignoreWarnings [codes]  Ignore TypeScript warnings by code
    -f, --configFile [path]       Specify the path to \`tsconfig.json\`
`)
  process.exit(0)
}

const cwd = process.cwd()
const code = argv.eval == null ? argv.print : argv.eval
const isEval = typeof code === 'string' || argv._.length === 0

// Register the TypeScript compiler instance.
const compile = register({
  getFile: isEval ? getFileEval : getFile,
  getVersion: isEval ? getVersionEval : getVersion,
  compiler: argv.compiler,
  ignoreWarnings: list(argv.ignoreWarnings),
  configFile: argv.configFile,
  isEval: isEval
})

// TypeScript files must always end with `.ts`.
const EVAL_FILENAME = '[eval].ts'
const EVAL_PATH = join(cwd, EVAL_FILENAME)

// Store eval contents for in-memory lookups.
const evalFile = { text: '', version: 0 }

if (typeof code === 'string') {
  global.__filename = EVAL_FILENAME
  global.__dirname = cwd

  const module = new Module(global.__filename)
  module.filename = global.__filename
  module.paths = Module._nodeModulePaths(global.__dirname)

  global.exports = module.exports
  global.module = module
  global.require = module.require.bind(module)

  let result: any

  try {
    result = _eval(code)
  } catch (err) {
    if (err instanceof TypeScriptError) {
      console.error(err.message)
      process.exit(1)
    }

    throw err
  }

  if (argv.print != null) {
    console.log(typeof result === 'string' ? result : inspect(result))
  }
} else {
  if (argv._.length) {
    const args = argv._.slice()

    args[0] = join(cwd, args[0])

    process.argv = ['node'].concat(args)
    process.execArgv.unshift(__filename)
    Module.runMain()
  } else {
    startRepl()
  }
}

/**
 * Evaluate the code snippet.
 */
function _eval (code: string) {
  // Increment eval constants for the compiler to pick up changes.
  evalFile.text = code
  evalFile.version++

  // Use `eval` for source maps to output properly, which use V8s error
  // frame `isEval` method to decide if it should offset the column by -62.
  return (0,eval)(compile(EVAL_PATH))
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
    result = _eval(code)
  } catch (e) {
    if (e instanceof TypeScriptError) {
      err = e.message
    } else {
      err = e
    }
  }

  callback(err, result)
}

/**
 * Split a string of values into an array.
 */
function list (value: string) {
  return String(value).split(/ *, */)
}

/**
 * Get the file text, checking for eval first.
 */
function getFileEval (fileName: string) {
  return fileName === EVAL_PATH ? evalFile.text : getFile(fileName)
}

/**
 * Get the file version, checking for eval first.
 */
function getVersionEval (fileName: string) {
  return fileName === EVAL_PATH ? String(evalFile.version) : getVersion(fileName)
}
