import { join, resolve } from 'path'
import { start } from 'repl'
import { inspect } from 'util'
import arrify = require('arrify')
import Module = require('module')
import minimist = require('minimist')
import chalk = require('chalk')
import { createScript } from 'vm'
import { register, VERSION, getFile, fileExists, TSError, parse } from './index'

interface Argv {
  eval?: string
  print?: string
  fast?: boolean
  lazy?: boolean
  cache?: boolean
  cacheDirectory?: string
  version?: boolean
  help?: boolean
  compiler?: string
  project?: string
  require?: string | string[]
  ignore?: boolean | string | string[]
  ignoreWarnings?: string | string[]
  disableWarnings?: boolean
  compilerOptions?: any
  _: string[]
}

const strings = ['eval', 'print', 'compiler', 'project', 'ignoreWarnings', 'require', 'cacheDirectory', 'ignore']
const booleans = ['help', 'fast', 'lazy', 'version', 'disableWarnings', 'cache']

const aliases: { [key: string]: string[] } = {
  help: ['h'],
  fast: ['F'],
  lazy: ['L'],
  version: ['v'],
  eval: ['e'],
  print: ['p'],
  project: ['P'],
  compiler: ['C'],
  require: ['r'],
  cacheDirectory: ['cache-directory'],
  ignoreWarnings: ['I', 'ignore-warnings'],
  disableWarnings: ['D', 'disable-warnings'],
  compilerOptions: ['O', 'compiler-options']
}

let stop = process.argv.length

function isFlagOnly (arg: string) {
  const name = arg.replace(/^--?/, '')

  // The value is part of this argument.
  if (/=/.test(name) || /^--no-/.test(arg)) {
    return true
  }

  for (const bool of booleans) {
    if (name === bool) {
      return true
    }

    const alias = aliases[bool]

    if (alias) {
      for (const other of alias) {
        if (other === name) {
          return true
        }
      }
    }
  }

  return false
}

// Hack around known subarg issue with `stopEarly`.
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  const next = process.argv[i + 1]

  if (/^\[/.test(arg) || /\]$/.test(arg)) {
    continue
  }

  if (/^-/.test(arg)) {
    // Skip next argument.
    if (!isFlagOnly(arg) && !/^-/.test(next)) {
      i++
    }

    continue
  }

  stop = i
  break
}

const argv = minimist<Argv>(process.argv.slice(2, stop), {
  string: strings,
  boolean: booleans,
  alias: aliases,
  default: {
    cache: true
  }
})

if (argv.version) {
  console.log(`ts-node v${VERSION}`)
  console.log(`node ${process.version}`)
  process.exit(0)
}

if (argv.help) {
  console.log(`
Usage: ts-node [options] [ -e script | script.ts ] [arguments]

Options:

  -e, --eval [code]              Evaluate code
  -p, --print [code]             Evaluate code and print result
  -r, --require [path]           Require a node module for execution
  -C, --compiler [name]          Specify a custom TypeScript compiler
  -I, --ignoreWarnings [code]    Ignore TypeScript warnings by diagnostic code
  -D, --disableWarnings          Ignore every TypeScript warning
  -P, --project [path]           Path to TypeScript project (or \`false\`)
  -O, --compilerOptions [opts]   JSON object to merge with compiler options
  -L, --lazy                     Lazily load TypeScript compilation on demand
  -F, --fast                     Run TypeScript compilation in transpile mode
  --ignore [regexp], --no-ignore Set the ignore check (default: \`/node_modules/\`)
  --no-cache                     Disable the TypeScript cache
  --cache-directory              Configure the TypeScript cache directory
`)

  process.exit(0)
}

/**
 * Override `process.emit` for clearer compiler errors.
 */
const _emit = process.emit

process.emit = function (type, error): boolean {
  // Print the error message when no other listeners are present.
  if (type === 'uncaughtException' && error instanceof TSError && process.listeners(type).length === 0) {
    printAndExit(error)
  }

  return _emit.apply(this, arguments)
}

const cwd = process.cwd()
const code = argv.eval == null ? argv.print : argv.eval
const isEvalScript = typeof argv.eval === 'string' || !!argv.print // Minimist struggles with empty strings.
const isEval = isEvalScript || stop === process.argv.length
const isPrinted = argv.print != null

// Register the TypeScript compiler instance.
const service = register({
  fast: argv.fast,
  lazy: argv.lazy,
  cache: argv.cache,
  cacheDirectory: argv.cacheDirectory,
  compiler: argv.compiler,
  project: argv.project,
  ignore: typeof argv.ignore === 'boolean' ? argv.ignore : arrify(argv.ignore),
  ignoreWarnings: arrify(argv.ignoreWarnings),
  disableWarnings: argv.disableWarnings,
  compilerOptions: parse(argv.compilerOptions),
  getFile: isEval ? getFileEval : getFile,
  fileExists: isEval ? fileExistsEval : fileExists
})

// Increment the `eval` id to keep track of execution.
let evalId = 0

// Note: TypeScript files must always end with `.ts`.
const EVAL_FILES: { [path: string]: string } = {}

// Require specified modules before start-up.
for (const id of arrify(argv.require)) {
  Module._load(id)
}

// Execute the main contents (either eval, script or piped).
if (isEvalScript) {
  evalAndExit(code as string, isPrinted)
} else {
  if (stop < process.argv.length) {
    const args = process.argv.slice(stop)
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
  ;(global as any).__filename = getEvalFileName(evalId)
  ;(global as any).__dirname = cwd

  const module = new Module((global as any).__filename)
  module.filename = (global as any).__filename
  module.paths = Module._nodeModulePaths((global as any).__dirname)

  ;(global as any).exports = module.exports
  ;(global as any).module = module
  ;(global as any).require = module.require.bind(module)

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
  const isCompletion = !/\n$/.test(code)
  const evalFilename = getEvalFileName(evalId++)
  const evalPath = join(cwd, evalFilename)
  const evalCode = getEvalContents(code)

  const output = service().compile(evalCode, evalPath)

  const script = createScript(output, evalFilename)
  const result = script.runInNewContext(context)

  if (!isCompletion) {
    EVAL_FILES[evalPath] = evalCode
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

  ;(repl as any).defineCommand('type', {
    help: 'Check the type of a TypeScript identifier',
    action: function (identifier: string) {
      if (!identifier) {
        ;(repl as any).displayPrompt()
        return
      }

      const fileName = getEvalFileName(evalId++)
      const contents = getEvalContents(identifier)

      // Cache the file for language services lookup.
      EVAL_FILES[fileName] = contents

      const { name, comment } = service().getTypeInfo(fileName, contents.length)

      // Delete the file from the cache after used for lookup.
      delete EVAL_FILES[fileName]

      ;(repl as any).outputStream.write(`${chalk.bold(name)}\n${comment ? `${comment}\n` : ''}`)
      ;(repl as any).displayPrompt()
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
 * Get the file text, checking for eval first.
 */
function getFileEval (fileName: string) {
  return EVAL_FILES.hasOwnProperty(fileName) ? EVAL_FILES[fileName] : getFile(fileName)
}

/**
 * Get whether the file exists.
 */
function fileExistsEval (fileName: string) {
  return EVAL_FILES.hasOwnProperty(fileName) || fileExists(fileName)
}

/**
 * Create an file for evaluation.
 */
function getEvalContents (code: string) {
  const refs = Object.keys(EVAL_FILES).map(x => `/// <reference path="${x}" />`).join('\n')

  return `${refs}\n${code}`
}

/**
 * Retrieve the eval filename.
 */
function getEvalFileName (index: number) {
  return `[eval ${index}].ts`
}
