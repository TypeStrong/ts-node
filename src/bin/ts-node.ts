#!/usr/bin/env node

import { join, resolve } from 'path'
import { start } from 'repl'
import { inspect } from 'util'
import Module = require('module')
import minimist = require('minimist')
import chalk = require('chalk')
import { diffLines } from 'diff'
import { createScript } from 'vm'
import { register, VERSION, getFile, getVersion, TSError } from '../ts-node'

interface Argv {
  eval?: string
  print?: string
  version?: boolean
  help?: boolean
  compiler?: string
  project?: string
  ignoreWarnings?: string | string[]
  disableWarnings?: boolean
  noProject?: boolean
  _: string[]
}

const argv = minimist<Argv>(process.argv.slice(2), {
  stopEarly: true,
  string: ['eval', 'print', 'compiler', 'project', 'ignoreWarnings'],
  boolean: ['help', 'version', 'disableWarnings', 'noProject'],
  alias: {
    v: ['version'],
    e: ['eval'],
    p: ['print'],
    P: ['project'],
    c: ['compiler'],
    i: ['ignoreWarnings', 'ignore-warnings'],
    d: ['disableWarnings', 'disable-warnings'],
    n: ['noProject', 'no-project']
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
  -i, --ignoreWarnings [codes]  Ignore TypeScript warnings by diagnostic code
  -d, --disableWarnings         Ignore every TypeScript warning
  -n, --noProject               Ignore the "tsconfig.json" project file
  -P, --project [path]          Specify the path to the TypeScript project
`)
  process.exit(0)
}

/**
 * Override `process.emit` for clearer compiler errors.
 */
const _emit = process.emit

process.emit = function (type, error) {
  // Print the error message when no other listeners are present.
  if (type === 'uncaughtException' && error instanceof TSError && process.listeners(type).length === 0) {
    return printAndExit(error)
  }

  return _emit.apply(this, arguments)
}

const cwd = process.cwd()
const code = argv.eval == null ? argv.print : argv.eval
const isEvalScript = typeof argv.eval === 'string' || !!argv.print // Minimist struggles with empty strings.
const isEval = isEvalScript || argv._.length === 0
const isPrinted = argv.print != null

// Register the TypeScript compiler instance.
const service = register({
  getFile: isEval ? getFileEval : getFile,
  getVersion: isEval ? getVersionEval : getVersion,
  compiler: argv.compiler,
  ignoreWarnings: list(argv.ignoreWarnings),
  project: argv.project,
  disableWarnings: argv.disableWarnings,
  noProject: argv.noProject
})

// TypeScript files must always end with `.ts`.
const EVAL_FILENAME = '[eval].ts'
const EVAL_PATH = join(cwd, EVAL_FILENAME)

// Store eval contents for in-memory lookups.
const evalFile = { input: '', output: '', version: 0 }

if (isEvalScript) {
  evalAndExit(code, isPrinted)
} else {
  if (argv._.length) {
    const args = argv._.slice()
    args[0] = resolve(cwd, args[0])
    process.argv = ['node'].concat(args)
    process.execArgv.unshift(__filename)
    Module.runMain()
  } else {
    // Piping of execution _only_ occurs when no other script is specified.
    if ((process.stdin as any).isTTY) {
      startRepl()
    } else {
      let code = ''
      process.stdin.on('data', (chunk: Buffer) => code += chunk)
      process.stdin.on('end', () => evalAndExit(code, isPrinted))
    }
  }
}

/**
 * Evaluate a script.
 */
function evalAndExit (code: string, isPrinted: boolean) {
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
  } catch (error) {
    if (error instanceof TSError) {
      printAndExit(error)
    }

    throw error
  }

  if (isPrinted) {
    console.log(typeof result === 'string' ? result : inspect(result))
  }

  process.exit(0)
}

/**
 * Stringify the `TSError` instance.
 */
function print (error: TSError) {
  return chalk.bold(`${chalk.red('⨯')} Unable to compile TypeScript`) + `\n${error.diagnostics.join('\n')}`
}

/**
 * Print the error and exit.
 */
function printAndExit (error: TSError) {
  console.error(print(error))
  process.exit(1)
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

  // Undo on TypeScript compilation errors.
  try {
    output = service.compile(EVAL_PATH)
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

  let result: any

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

  ;(repl as any).defineCommand('type', {
    help: 'Check the type of a TypeScript identifier',
    action: function (identifier: string) {
      if (!identifier) {
        ;(repl as any).displayPrompt()
        return
      }

      const undo = evalFile.input

      evalFile.input += identifier
      evalFile.version++

      const { name, comment } = service.getTypeInfo(EVAL_PATH, evalFile.input.length)

      ;(repl as any).outputStream.write(`${chalk.bold(name)}\n${comment ? `${comment}\n` : ''}`)
      ;(repl as any).displayPrompt()

      evalFile.input = undo
    }
  })
}

/**
 * Eval code from the REPL.
 */
function replEval (code: string, context: any, filename: string, callback: (err?: Error, result?: any) => any) {
  let err: any
  let result: any

  // TODO: Figure out how to handle completion here.
  if (code === '.scope') {
    callback()
    return
  }

  try {
    result = _eval(code, context)
  } catch (error) {
    if (error instanceof TSError) {
      err = print(error)
    } else {
      err = error
    }
  }

  callback(err, result)
}

/**
 * Split a string of values into an array.
 */
function list (value: string | string[]) {
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
