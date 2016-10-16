import { join, resolve, basename } from 'path'
import { start, Recoverable } from 'repl'
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

const cwd = process.cwd()
const code = argv.eval == null ? argv.print : argv.eval
const isEvalScript = typeof argv.eval === 'string' || !!argv.print // Minimist struggles with empty strings.
const isEval = isEvalScript || stop === process.argv.length
const isPrinted = argv.print != null
const supportsScriptOptions = parseFloat(process.version.substr(1)) >= 1

// Register the TypeScript compiler instance.
const service = register({
  fast: argv.fast,
  lazy: argv.lazy,
  cache: argv.cache,
  cacheDirectory: argv.cacheDirectory,
  compiler: argv.compiler,
  project: argv.project,
  ignore: argv.ignore,
  ignoreWarnings: argv.ignoreWarnings,
  disableWarnings: argv.disableWarnings,
  compilerOptions: parse(argv.compilerOptions),
  getFile: isEval ? getFileEval : getFile,
  fileExists: isEval ? fileExistsEval : fileExists
})

// Increment the `eval` id to keep track of execution.
let evalId = 0

// Note: TypeScript files must always end with `.ts`.
const EVAL_PATHS: { [path: string]: string } = {}

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
  const filename = getEvalFileName(evalId)

  const module = new Module(filename)
  module.filename = filename
  module.paths = Module._nodeModulePaths(cwd)

  ;(global as any).__filename = filename
  ;(global as any).__dirname = cwd
  ;(global as any).exports = module.exports
  ;(global as any).module = module
  ;(global as any).require = module.require.bind(module)

  let result: any

  try {
    result = _eval(code, global)
  } catch (error) {
    if (error instanceof TSError) {
      console.error(print(error))
      process.exit(1)
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
  const title = `${chalk.red('⨯')} Unable to compile TypeScript`

  return `${chalk.bold(title)}\n${error.diagnostics.map(x => x.message).join('\n')}`
}

/**
 * Evaluate the code snippet.
 */
function _eval (input: string, context: any) {
  const isCompletion = !/\n$/.test(input)
  const path = join(cwd, getEvalFileName(evalId++))
  const { code, lineOffset } = getEvalContent(input)
  const filename = basename(path)

  const output = service().compile(code, path, lineOffset)

  const script = createScript(output, supportsScriptOptions ? { filename, lineOffset } : filename)
  const result = script.runInNewContext(context)

  if (!isCompletion) {
    EVAL_PATHS[path] = code
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

  repl.defineCommand('type', {
    help: 'Check the type of a TypeScript identifier',
    action: function (identifier: string) {
      if (!identifier) {
        repl.displayPrompt()
        return
      }

      const path = join(cwd, getEvalFileName(evalId++))
      const { code, lineOffset } = getEvalContent(identifier)

      // Cache the file for language services lookup.
      EVAL_PATHS[path] = code

      const { name, comment } = service().getTypeInfo(path, code.length)

      // Delete the file from the cache after used for lookup.
      delete EVAL_PATHS[path]

      repl.outputStream.write(`${chalk.bold(name)}\n${comment ? `${comment}\n` : ''}`)
      repl.displayPrompt()
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
      // Support recoverable compilations using >= node 6.
      if (typeof Recoverable === 'function' && isRecoverable(error)) {
        err = new Recoverable(error)
      } else {
        err = print(error)
      }
    } else {
      err = error
    }
  }

  callback(err, result)
}

/**
 * Get the file text, checking for eval first.
 */
function getFileEval (path: string) {
  return EVAL_PATHS.hasOwnProperty(path) ? EVAL_PATHS[path] : getFile(path)
}

/**
 * Get whether the file exists.
 */
function fileExistsEval (path: string) {
  return EVAL_PATHS.hasOwnProperty(path) || fileExists(path)
}

/**
 * Create an file for evaluation.
 */
function getEvalContent (input: string) {
  const refs = Object.keys(EVAL_PATHS).map(x => `/// <reference path="${x}" />\n`)

  return {
    lineOffset: -refs.length,
    code: refs.join('') + input
  }
}

/**
 * Retrieve the eval filename.
 */
function getEvalFileName (index: number) {
  return `[eval ${index}].ts`
}

const RECOVERY_CODES: number[] = [
  1003, // "Identifier expected."
  1005, // "')' expected."
  1109, // "Expression expected."
  1126, // "Unexpected end of text."
  1160, // "Unterminated template literal."
  1161 // "Unterminated regular expression literal."
]

/**
 * Check if a function can recover gracefully.
 */
function isRecoverable (error: TSError) {
  return error.diagnostics.every(x => RECOVERY_CODES.indexOf(x.code) > -1)
}
