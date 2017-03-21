import { join, resolve } from 'path'
import { start, Recoverable } from 'repl'
import { inspect } from 'util'
import arrify = require('arrify')
import Module = require('module')
import minimist = require('minimist')
import chalk = require('chalk')
import { diffLines } from 'diff'
import { Script } from 'vm'
import { register, VERSION, getFile, fileExists, TSError, parse } from './index'

interface Argv {
  eval?: string
  print?: string
  fast?: boolean
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
const booleans = ['help', 'fast', 'version', 'disableWarnings', 'cache']

const aliases: { [key: string]: string[] } = {
  help: ['h'],
  fast: ['F'],
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

// Register the TypeScript compiler instance.
const service = register({
  fast: argv.fast,
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

// Require specified modules before start-up.
;(Module as any)._preloadModules(arrify(argv.require))

/**
 * Eval helpers.
 */
const EVAL_FILENAME = `[eval].ts`
const EVAL_PATH = join(cwd, EVAL_FILENAME)
const EVAL_INSTANCE = { input: '', output: '', version: 0, lines: 0 }

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
  const module = new Module(EVAL_FILENAME)
  module.filename = EVAL_FILENAME
  module.paths = Module._nodeModulePaths(cwd)

  ;(global as any).__filename = EVAL_FILENAME
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
  const lines = EVAL_INSTANCE.lines
  const isCompletion = !/\n$/.test(input)
  const undo = appendEval(input)
  let output: string

  try {
    output = service.compile(EVAL_INSTANCE.input, EVAL_PATH, -lines)
  } catch (err) {
    undo()

    throw err
  }

  // Use `diff` to check for new JavaScript to execute.
  const changes = diffLines(EVAL_INSTANCE.output, output)

  if (isCompletion) {
    undo()
  } else {
    EVAL_INSTANCE.output = output
  }

  let result: any

  for (const change of changes) {
    if (change.added) {
      const script = new Script(change.value, EVAL_FILENAME)

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

  const undo = appendEval('')

  repl.on('reset', () => undo())

  repl.defineCommand('type', {
    help: 'Check the type of a TypeScript identifier',
    action: function (identifier: string) {
      if (!identifier) {
        repl.displayPrompt()
        return
      }

      const undo = appendEval(identifier)
      const { name, comment } = service.getTypeInfo(EVAL_PATH, EVAL_INSTANCE.input.length)

      undo()

      repl.outputStream.write(`${chalk.bold(name)}\n${comment ? `${comment}\n` : ''}`)
      repl.displayPrompt()
    }
  })
}

/**
 * Eval code from the REPL.
 */
function replEval (code: string, context: any, _filename: string, callback: (err?: Error, result?: any) => any) {
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
 * Append to the eval instance and return an undo function.
 */
function appendEval (input: string) {
  const undoInput = EVAL_INSTANCE.input
  const undoVersion = EVAL_INSTANCE.version
  const undoOutput = EVAL_INSTANCE.output
  const undoLines = EVAL_INSTANCE.lines

  // Handle ASI issues with TypeScript re-evaluation.
  if (undoInput.charAt(undoInput.length - 1) === '\n' && /^\s*[\[\(\`]/.test(input) && !/;\s*$/.test(undoInput)) {
    EVAL_INSTANCE.input = `${EVAL_INSTANCE.input.slice(0, -1)};\n`
  }

  EVAL_INSTANCE.input += input
  EVAL_INSTANCE.lines += lineCount(input)
  EVAL_INSTANCE.version++

  return function () {
    EVAL_INSTANCE.input = undoInput
    EVAL_INSTANCE.output = undoOutput
    EVAL_INSTANCE.version = undoVersion
    EVAL_INSTANCE.lines = undoLines
  }
}

/**
 * Count the number of lines.
 */
function lineCount (value: string) {
  let count = 0

  for (const char of value) {
    if (char === '\n') {
      count++
    }
  }

  return count
}

/**
 * Get the file text, checking for eval first.
 */
function getFileEval (path: string) {
  return path === EVAL_PATH ? EVAL_INSTANCE.input : getFile(path)
}

/**
 * Get whether the file exists.
 */
function fileExistsEval (path: string) {
  return path === EVAL_PATH || fileExists(path)
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
