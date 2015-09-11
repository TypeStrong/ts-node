import { join } from 'path'
import { start } from 'repl'
import { inspect } from 'util'
import { readFileSync } from 'fs'
import Module = require('module')
import extend = require('xtend')
import minimist = require('minimist')
import { register, VERSION } from '../typescript-node'

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

const compiler = register({
  compiler: argv.compiler,
  ignoreWarnings: list(argv.ignoreWarnings),
  configFile: argv.compiler
})

const cwd = process.cwd()
const code = argv.eval == null ? argv.print : argv.eval

// TypeScript files must always end with `.ts`.
const EVAL_FILENAME = '[eval].ts'
const EVAL_PATH = join(cwd, EVAL_FILENAME)

if (typeof code === 'string') {
  global.__filename = EVAL_FILENAME
  global.__dirname = cwd

  const module = new Module(global.__filename)
  module.filename = global.__filename
  module.paths = Module._nodeModulePaths(global.__dirname)

  global.exports = module.exports
  global.module = module
  global.require = module.require.bind(module)

  var result = _eval(code, EVAL_PATH)

  if (argv.print != null) {
    var output = typeof result === 'string' ? result : inspect(result)
    process.stdout.write(output + '\n')
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
function _eval (code: string, filename: string) {
  // Use `eval` for source maps to output properly, which use V8s error
  // frame `isEval` method to decide if it should offset the column by -62.
  return (0,eval)(compiler(filename, code))
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
    result = _eval(code, EVAL_PATH)
  } catch (e) {
    err = e
  }

  callback(err, result)
}

/**
 * Split a string of values into an array.
 */
function list (value: string) {
  return String(value).split(/ *, */)
}
