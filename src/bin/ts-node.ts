import { join } from 'path'
import { start } from 'repl'
import { inspect } from 'util'
import { readFileSync } from 'fs'
import Module = require('module')
import extend = require('xtend')
import minimist = require('minimist')
import { diffLines } from 'diff'
import { createScript } from 'vm'
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
const evalFile = { input: '', output: '', version: 0 }

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
    result = _eval(code, global)
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
function _eval (code: string, context: any) {
  const undo = evalFile.input
  const isCompletion = !/\n$/.test(code)

  // Increment eval constants for the compiler to pick up changes.
  evalFile.input += code
  evalFile.version++

  let output: string
  let result: any

  // Compile changes within a `try..catch` to undo changes on compilation error.
  try {
    output = compile(EVAL_PATH)
  } catch (error) {
    evalFile.input = undo

    throw error
  }

  // Use `diff` to check for new JavaScript to execute.
  const changes = diffLines(evalFile.output, output)

  // Revert the code if running in "completion" environment. Updated the output
  // to diff against future executions when evaling code.
  if (isCompletion) {
    evalFile.input = undo
  } else {
    evalFile.output = output
  }

  // Iterate over the diff and evaluate `added` lines. The only removed lines
  // should be the source map and lines that stay the same are ignored.
  for (const change of changes) {
    if (change.added) {
      const script = createScript(change.value, EVAL_FILENAME)

      result = script.runInNewContext(context)
    }
  }

  return result
}

/**
 * Start a CLI REPL.
 */
function startRepl () {
  const repl = start({
    prompt: '> ',
    input: process.stdin,
    output: process.stdout,
    eval: replEval,
    useGlobal: false
  })

  // Reset eval file information when repl is reset.
  repl.on('reset', () => {
    evalFile.input = ''
    evalFile.output = ''
    evalFile.version = 0
  })
}

/**
 * Eval code from the REPL.
 */
function replEval (code: string, context: any, filename: string, callback: (err?: Error, result?: any) => any) {
  let err: Error
  let result: any

  // TODO: Figure out how to handle completion here.
  if (code === '.scope') {
    callback()
    return
  }

  try {
    result = _eval(code, context)
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
  return fileName === EVAL_PATH ? evalFile.input : getFile(fileName)
}

/**
 * Get the file version, checking for eval first.
 */
function getVersionEval (fileName: string) {
  return fileName === EVAL_PATH ? String(evalFile.version) : getVersion(fileName)
}
