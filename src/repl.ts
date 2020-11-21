import { diffLines } from 'diff'
import { homedir } from 'os'
import { join } from 'path'
import { Recoverable, start } from 'repl'
import { Script } from 'vm'
import { Register, CreateOptions, TSError } from './index'
import { readFileSync, statSync } from 'fs'
import { Console } from 'console'
import * as tty from 'tty'

/**
 * Eval filename for REPL/debug.
 * @internal
 */
export const EVAL_FILENAME = `[eval].ts`

export interface ReplService {
  readonly state: EvalState
  /**
   * Bind this REPL to a ts-node compiler service.  A compiler service must be bound before `eval`-ing code or starting the REPL
   */
  setService (service: Register): void
  evalCode (code: string): void
  /**
   * `eval` implementation compatible with node's REPL API
   */
  nodeReplEval (code: string, _context: any, _filename: string, callback: (err: Error | null, result?: any) => any): void
  evalAwarePartialHost: EvalAwarePartialHost
  /** Start a node REPL */
  start (code?: string): void
  /** @internal */
  readonly stdin: NodeJS.ReadableStream
  /** @internal */
  readonly stdout: NodeJS.WritableStream
  /** @internal */
  readonly stderr: NodeJS.WritableStream
  /** @internal */
  readonly console: Console
}

export interface CreateReplServiceOptions {
  service?: Register
  state?: EvalState
  stdin?: NodeJS.ReadableStream
  stdout?: NodeJS.WritableStream
  stderr?: NodeJS.WritableStream
}

export function createReplService (options: CreateReplServiceOptions = {}) {
  let service = options.service
  const state = options.state ?? new EvalState(join(process.cwd(), EVAL_FILENAME))
  const evalAwarePartialHost = createEvalAwarePartialHost(state)
  const stdin = options.stdin ?? process.stdin
  const stdout = options.stdout ?? process.stdout
  const stderr = options.stderr ?? process.stderr
  const _console = stdout === process.stdout && stderr === process.stderr ? console : new Console(stdout, stderr)

  const replService: ReplService = {
    state: options.state ?? new EvalState(join(process.cwd(), EVAL_FILENAME)),
    setService,
    evalCode,
    nodeReplEval,
    evalAwarePartialHost,
    start,
    stdin,
    stdout,
    stderr,
    console: _console
  }
  return replService

  function setService (_service: Register) {
    service = _service
  }

  function evalCode (code: string) {
    return _eval(service!, state, code)
  }

  function nodeReplEval (code: string, _context: any, _filename: string, callback: (err: Error | null, result?: any) => any) {
    let err: Error | null = null
    let result: any

    // TODO: Figure out how to handle completion here.
    if (code === '.scope') {
      callback(err)
      return
    }

    try {
      result = evalCode(code)
    } catch (error) {
      if (error instanceof TSError) {
        // Support recoverable compilations using >= node 6.
        if (Recoverable && isRecoverable(error)) {
          err = new Recoverable(error)
        } else {
          console.error(error)
        }
      } else {
        err = error
      }
    }

    return callback(err, result)
  }

  function start (code?: string) {
    // TODO assert that service is set; remove all ! postfixes
    return startRepl(replService, service!, state, code)
  }
}

/**
 * Eval state management. Stores virtual `[eval].ts` file
 */
export class EvalState {
  /** @internal */
  input = ''
  /** @internal */
  output = ''
  /** @internal */
  version = 0
  /** @internal */
  lines = 0

  // tslint:disable-next-line:variable-name
  __tsNodeEvalStateBrand: unknown

  constructor (public path: string) { }
}

/**
 * Filesystem host functions which are aware of the "virtual" [eval].ts file used to compile REPL inputs.
 * Must be passed to `create()` to create a ts-node compiler service which can compile REPL inputs.
 */
export type EvalAwarePartialHost = Pick<CreateOptions, 'readFile' | 'fileExists'>

export function createEvalAwarePartialHost (state: EvalState): EvalAwarePartialHost {
  function readFile (path: string) {
    if (path === state.path) return state.input

    try {
      return readFileSync(path, 'utf8')
    } catch (err) {/* Ignore. */}
  }
  function fileExists (path: string) {
    if (path === state.path) return true

    try {
      const stats = statSync(path)
      return stats.isFile() || stats.isFIFO()
    } catch (err) {
      return false
    }
  }
  return { readFile, fileExists }
}

/**
 * Evaluate the code snippet.
 */
function _eval (service: Register, state: EvalState, input: string) {
  const lines = state.lines
  const isCompletion = !/\n$/.test(input)
  const undo = appendEval(state, input)
  let output: string

  try {
    output = service.compile(state.input, state.path, -lines)
  } catch (err) {
    undo()
    throw err
  }

  // Use `diff` to check for new JavaScript to execute.
  const changes = diffLines(state.output, output)

  if (isCompletion) {
    undo()
  } else {
    state.output = output
  }

  return changes.reduce((result, change) => {
    return change.added ? exec(change.value, state.path) : result
  }, undefined)
}

/**
 * Execute some code.
 */
function exec (code: string, filename: string) {
  const script = new Script(code, { filename: filename })

  return script.runInThisContext()
}

/**
 * Start a CLI REPL.
 */
function startRepl (replService: ReplService, service: Register, state: EvalState, code?: string) {
  // Eval incoming code before the REPL starts.
  if (code) {
    try {
      replService.evalCode(`${code}\n`)
    } catch (err) {
      replService.console.error(err)
      process.exit(1)
    }
  }

  const repl = start({
    prompt: '> ',
    input: replService.stdin,
    output: replService.stdout,
    // Mimicking node's REPL implementation: https://github.com/nodejs/node/blob/168b22ba073ee1cbf8d0bcb4ded7ff3099335d04/lib/internal/repl.js#L28-L30
    terminal: (replService.stdout as tty.WriteStream).isTTY && !parseInt(process.env.NODE_NO_READLINE!, 10),
    eval: replService.nodeReplEval,
    useGlobal: true
  })

  // Bookmark the point where we should reset the REPL state.
  const resetEval = appendEval(state, '')

  function reset () {
    resetEval()

    // Hard fix for TypeScript forcing `Object.defineProperty(exports, ...)`.
    exec('exports = module.exports', state.path)
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

      const undo = appendEval(state, identifier)
      const { name, comment } = service.getTypeInfo(state.input, state.path, state.input.length)

      undo()

      if (name) repl.outputStream.write(`${name}\n`)
      if (comment) repl.outputStream.write(`${comment}\n`)
      repl.displayPrompt()
    }
  })

  // Set up REPL history when available natively via node.js >= 11.
  if (repl.setupHistory) {
    const historyPath = process.env.TS_NODE_HISTORY || join(homedir(), '.ts_node_repl_history')

    repl.setupHistory(historyPath, err => {
      if (!err) return

      replService.console.error(err)
      process.exit(1)
    })
  }
}

/**
 * Append to the eval instance and return an undo function.
 */
function appendEval (state: EvalState, input: string) {
  const undoInput = state.input
  const undoVersion = state.version
  const undoOutput = state.output
  const undoLines = state.lines

  // Handle ASI issues with TypeScript re-evaluation.
  if (undoInput.charAt(undoInput.length - 1) === '\n' && /^\s*[\/\[(`-]/.test(input) && !/;\s*$/.test(undoInput)) {
    state.input = `${state.input.slice(0, -1)};\n`
  }

  state.input += input
  state.lines += lineCount(input)
  state.version++

  return function () {
    state.input = undoInput
    state.output = undoOutput
    state.version = undoVersion
    state.lines = undoLines
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

const RECOVERY_CODES: Set<number> = new Set([
  1003, // "Identifier expected."
  1005, // "')' expected."
  1109, // "Expression expected."
  1126, // "Unexpected end of text."
  1160, // "Unterminated template literal."
  1161, // "Unterminated regular expression literal."
  2355 // "A function whose declared type is neither 'void' nor 'any' must return a value."
])

/**
 * Check if a function can recover gracefully.
 */
function isRecoverable (error: TSError) {
  return error.diagnosticCodes.every(code => RECOVERY_CODES.has(code))
}
