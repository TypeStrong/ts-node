import { ITSNodeArgs } from './args'
import { join } from 'path'
import { start, Recoverable } from 'repl'
import { inspect } from 'util'
import arrify = require('arrify')
import Module = require('module')
import chalk from 'chalk'
import { diffLines } from 'diff'
import { Script } from 'vm'
import { register, Register, VERSION, getFile, fileExists, TSError, parse, printError } from './index'

const cwd = process.cwd()

/**
 * Eval helpers.
 */
const EVAL_FILENAME = `[eval].ts`
const EVAL_PATH = join(cwd, EVAL_FILENAME)
const EVAL_INSTANCE = { input: '', output: '', version: 0, lines: 0 }

/**
 * Print version information for debugging purposes, and exit
 *
 * @param exitCode
 */
function printVersionInformationAndExit (service: any, exitCode: number = 0) {
  console.log(`ts-node v${VERSION}`)
  console.log(`node ${process.version}`)
  console.log(`typescript v${service.ts.version}`)
  console.log(`cache ${JSON.stringify(service.cachedir)}`)
  process.exit(exitCode)
}

/**
 * Interface describing the object received by
 * the exported execute method
 */
export interface IExecuteOptions {
  tsNodeArgs: ITSNodeArgs
  scriptFile: string
  scriptArgs: string[]
}

/**
 * Execute the received script, or start in REPL mode
 */
export function execute ({
  tsNodeArgs,
  scriptFile,
  scriptArgs
}: IExecuteOptions) {
  const code = tsNodeArgs.eval === undefined ? tsNodeArgs.print : tsNodeArgs.eval
  const isPrinted = tsNodeArgs.print !== undefined
  const isEval = scriptArgs.length === 0

  // Minimist struggles with empty strings.
  const isEvalScript = typeof tsNodeArgs.eval === 'string' || !!tsNodeArgs.print

  // Register the TypeScript compiler instance.
  const service = register({
    typeCheck: tsNodeArgs.typeCheck,
    cache: tsNodeArgs.cache,
    cacheDirectory: tsNodeArgs.cacheDirectory,
    compiler: tsNodeArgs.compiler,
    project: tsNodeArgs.project,
    ignore: tsNodeArgs.ignore,
    ignoreWarnings: tsNodeArgs.ignoreWarnings,
    compilerOptions: parse(tsNodeArgs.compilerOptions),
    getFile: isEval ? getFileEval : getFile,
    fileExists: isEval ? fileExistsEval : fileExists
  })

  // Output project information.
  if (tsNodeArgs.version) {
    return printVersionInformationAndExit(service)
  }

  // Require specified modules before start-up.
  (Module as any)._preloadModules(arrify(tsNodeArgs.require))

  // Execute the main contents (either eval, script or piped).
  if (isEvalScript) {
    // Evaluate the script bit fed as a CLI argument
    evalAndExit(service, code as string, isPrinted)
  } else if (scriptFile) {
    // We received a file to run, run this file
    process.argv = ['node', scriptFile].concat(scriptArgs)
    process.execArgv.unshift(__filename)
    Module.runMain()
  } else if ((process.stdin as any).isTTY) {
    // Run the REPL
    startRepl(service)
  } else {
    // We do not have a TTY, read script from stdin
    let code = ''
    process.stdin.on('data', (chunk: Buffer) => code += chunk)
    process.stdin.on('end', () => evalAndExit(service, code, isPrinted))
  }
}

/**
 * Evaluate a script.
 */
function evalAndExit (service: Register, code: string, isPrinted: boolean) {
  const module = new Module(EVAL_FILENAME)
  module.filename = EVAL_FILENAME
  module.paths = (Module as any)._nodeModulePaths(cwd)

  ;(global as any).__filename = EVAL_FILENAME
  ;(global as any).__dirname = cwd
  ;(global as any).exports = module.exports
  ;(global as any).module = module
  ;(global as any).require = module.require.bind(module)

  let result: any

  try {
    result = _eval(service, code, global)
  } catch (error) {
    if (error instanceof TSError) {
      console.error(printError(error))
      process.exit(1)
    }

    throw error
  }

  if (isPrinted) {
    console.log(typeof result === 'string' ? result : inspect(result))
  }
}

/**
 * Evaluate the code snippet.
 */
function _eval (service: Register, input: string, context: any) {
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

  return changes.reduce((result, change) => {
    return change.added ? exec(change.value, EVAL_FILENAME, context) : result
  }, undefined)
}

/**
 * Execute some code.
 */
function exec (code: string, filename: string, context: any) {
  const script = new Script(code, { filename: filename })

  return script.runInNewContext(context)
}

/**
 * Start a CLI REPL.
 */
function startRepl (service: Register) {
  const repl = start({
    prompt: '> ',
    input: process.stdin,
    output: process.stdout,
    eval: replEval.bind(null, service),
    useGlobal: false
  })

  // Bookmark the point where we should reset the REPL state.
  const resetEval = appendEval('')

  function reset () {
    resetEval()

    // Hard fix for TypeScript forcing `Object.defineProperty(exports, ...)`.
    exec('exports = module.exports', EVAL_FILENAME, (repl as any).context)
  }

  reset()
  repl.on('reset', reset)

  repl.defineCommand('type', {
    help: 'Check the type of a TypeScript identifier',
    action: function (identifier: string) {
      if (!identifier) {
        repl.displayPrompt()
        return
      }

      const undo = appendEval(identifier)
      const { name, comment } = service.getTypeInfo(EVAL_INSTANCE.input, EVAL_PATH, EVAL_INSTANCE.input.length)

      undo()

      repl.outputStream.write(`${chalk.bold(name)}\n${comment ? `${comment}\n` : ''}`)
      repl.displayPrompt()
    }
  })
}

/**
 * Eval code from the REPL.
 */
function replEval (service: Register, code: string, context: any, _filename: string, callback: (err?: Error, result?: any) => any) {
  let err: any
  let result: any

  // TODO: Figure out how to handle completion here.
  if (code === '.scope') {
    callback()
    return
  }

  try {
    result = _eval(service, code, context)
  } catch (error) {
    if (error instanceof TSError) {
      // Support recoverable compilations using >= node 6.
      if (Recoverable && isRecoverable(error)) {
        err = new Recoverable(error)
      } else {
        err = printError(error)
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
