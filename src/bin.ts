#!/usr/bin/env node

import { join, resolve, dirname } from 'path'
import { start, Recoverable } from 'repl'
import { inspect } from 'util'
import Module = require('module')
import arg = require('arg')
import { diffLines } from 'diff'
import { Script } from 'vm'
import { readFileSync, statSync } from 'fs'
import { homedir } from 'os'
import { VERSION, TSError, parse, Register, register } from './index'

/**
 * Eval filename for REPL/debug.
 */
const EVAL_FILENAME = `[eval].ts`

/**
 * Eval state management.
 */
class EvalState {
  input = ''
  output = ''
  version = 0
  lines = 0

  constructor (public path: string) {}
}

/**
 * Main `bin` functionality.
 */
export function main (argv: string[]) {
  const args = arg({
    // Node.js-like options.
    '--eval': String,
    '--interactive': Boolean,
    '--print': Boolean,
    '--require': [String],

    // CLI options.
    '--help': Boolean,
    '--script-mode': Boolean,
    '--version': arg.COUNT,

    // Project options.
    '--dir': String,
    '--files': Boolean,
    '--compiler': String,
    '--compiler-options': parse,
    '--project': String,
    '--ignore-diagnostics': [String],
    '--ignore': [String],
    '--transpile-only': Boolean,
    '--type-check': Boolean,
    '--compiler-host': Boolean,
    '--pretty': Boolean,
    '--skip-project': Boolean,
    '--skip-ignore': Boolean,
    '--prefer-ts-exts': Boolean,
    '--log-error': Boolean,
    '--emit': Boolean,

    // Aliases.
    '-e': '--eval',
    '-i': '--interactive',
    '-p': '--print',
    '-r': '--require',
    '-h': '--help',
    '-s': '--script-mode',
    '-v': '--version',
    '-T': '--transpile-only',
    '-H': '--compiler-host',
    '-I': '--ignore',
    '-P': '--project',
    '-C': '--compiler',
    '-D': '--ignore-diagnostics',
    '-O': '--compiler-options'
  }, {
    argv,
    stopAtPositional: true
  })

  // Only setting defaults for CLI-specific flags
  // Anything passed to `register()` can be `undefined`; `create()` will apply
  // defaults.
  const {
    '--dir': dir,
    '--help': help = false,
    '--script-mode': scriptMode = false,
    '--version': version = 0,
    '--require': argsRequire = [],
    '--eval': code = undefined,
    '--print': print = false,
    '--interactive': interactive = false,
    '--files': files,
    '--compiler': compiler,
    '--compiler-options': compilerOptions,
    '--project': project,
    '--ignore-diagnostics': ignoreDiagnostics,
    '--ignore': ignore,
    '--transpile-only': transpileOnly,
    '--type-check': typeCheck,
    '--compiler-host': compilerHost,
    '--pretty': pretty,
    '--skip-project': skipProject,
    '--skip-ignore': skipIgnore,
    '--prefer-ts-exts': preferTsExts,
    '--log-error': logError,
    '--emit': emit
  } = args

  if (help) {
    console.log(`
  Usage: ts-node [options] [ -e script | script.ts ] [arguments]

  Options:

    -e, --eval [code]              Evaluate code
    -p, --print                    Print result of \`--eval\`
    -r, --require [path]           Require a node module before execution
    -i, --interactive              Opens the REPL even if stdin does not appear to be a terminal

    -h, --help                     Print CLI usage
    -v, --version                  Print module version information
    -s, --script-mode              Use cwd from <script.ts> instead of current directory

    -T, --transpile-only           Use TypeScript's faster \`transpileModule\`
    -H, --compiler-host            Use TypeScript's compiler host API
    -I, --ignore [pattern]         Override the path patterns to skip compilation
    -P, --project [path]           Path to TypeScript JSON project file
    -C, --compiler [name]          Specify a custom TypeScript compiler
    -D, --ignore-diagnostics [code] Ignore TypeScript warnings by diagnostic code
    -O, --compiler-options [opts]   JSON object to merge with compiler options

    --dir                          Specify working directory for config resolution
    --scope                        Scope compiler to files within \`cwd\` only
    --files                        Load \`files\`, \`include\` and \`exclude\` from \`tsconfig.json\` on startup
    --pretty                       Use pretty diagnostic formatter (usually enabled by default)
    --skip-project                 Skip reading \`tsconfig.json\`
    --skip-ignore                  Skip \`--ignore\` checks
    --prefer-ts-exts               Prefer importing TypeScript files over JavaScript files
    --log-error                    Logs TypeScript errors to stderr instead of throwing exceptions
  `)

    process.exit(0)
  }

  // Output project information.
  if (version === 1) {
    console.log(`v${VERSION}`)
    process.exit(0)
  }

  const cwd = dir || process.cwd()
  const scriptPath = args._.length ? resolve(cwd, args._[0]) : undefined
  const state = new EvalState(scriptPath || join(cwd, EVAL_FILENAME))

  // Register the TypeScript compiler instance.
  const service = register({
    dir: getCwd(dir, scriptMode, scriptPath),
    emit,
    files,
    pretty,
    transpileOnly,
    typeCheck,
    compilerHost,
    ignore,
    preferTsExts,
    logError,
    project,
    skipProject,
    skipIgnore,
    compiler,
    ignoreDiagnostics,
    compilerOptions,
    readFile: code !== undefined
      ? (path: string) => {
        if (path === state.path) return state.input

        try {
          return readFileSync(path, 'utf8')
        } catch (err) {/* Ignore. */}
      }
      : undefined,
    fileExists: code !== undefined
      ? (path: string) => {
        if (path === state.path) return true

        try {
          const stats = statSync(path)
          return stats.isFile() || stats.isFIFO()
        } catch (err) {
          return false
        }
      }
      : undefined
  })

  const requires = argsRequire.length !== 0 ? argsRequire : service.options.requires || []

  // Output project information.
  if (version >= 2) {
    console.log(`ts-node v${VERSION}`)
    console.log(`node ${process.version}`)
    console.log(`compiler v${service.ts.version}`)
    process.exit(0)
  }

  // Create a local module instance based on `cwd`.
  const module = new Module(state.path)
  module.filename = state.path
  module.paths = (Module as any)._nodeModulePaths(cwd)

  // Require specified modules before start-up.
  ;(Module as any)._preloadModules(requires)

  // Prepend `ts-node` arguments to CLI for child processes.
  process.execArgv.unshift(__filename, ...process.argv.slice(2, process.argv.length - args._.length))
  process.argv = [process.argv[1]].concat(scriptPath || []).concat(args._.slice(1))

  // Execute the main contents (either eval, script or piped).
  if (code !== undefined && !interactive) {
    evalAndExit(service, state, module, code, print)
  } else {
    if (args._.length) {
      Module.runMain()
    } else {
      // Piping of execution _only_ occurs when no other script is specified.
      if (process.stdin.isTTY) {
        startRepl(service, state, code)
      } else {
        let buffer = code || ''
        process.stdin.on('data', (chunk: Buffer) => buffer += chunk)
        process.stdin.on('end', () => evalAndExit(service, state, module, buffer, print))
      }
    }
  }
}

/**
 * Get project path from args.
 */
function getCwd (dir?: string, scriptMode?: boolean, scriptPath?: string) {
  // Validate `--script-mode` usage is correct.
  if (scriptMode) {
    if (!scriptPath) {
      throw new TypeError('Script mode must be used with a script name, e.g. `ts-node -s <script.ts>`')
    }

    if (dir) {
      throw new TypeError('Script mode cannot be combined with `--dir`')
    }

    return dirname(scriptPath)
  }

  return dir
}

/**
 * Evaluate a script.
 */
function evalAndExit (service: Register, state: EvalState, module: Module, code: string, isPrinted: boolean) {
  let result: any

  ;(global as any).__filename = module.filename
  ;(global as any).__dirname = dirname(module.filename)
  ;(global as any).exports = module.exports
  ;(global as any).module = module
  ;(global as any).require = module.require.bind(module)

  try {
    result = _eval(service, state, code)
  } catch (error) {
    if (error instanceof TSError) {
      console.error(error)
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
function startRepl (service: Register, state: EvalState, code?: string) {
  // Eval incoming code before the REPL starts.
  if (code) {
    try {
      _eval(service, state, `${code}\n`)
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  }

  const repl = start({
    prompt: '> ',
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdout.isTTY,
    eval: replEval,
    useGlobal: true
  })

  /**
   * Eval code from the REPL.
   */
  function replEval (code: string, _context: any, _filename: string, callback: (err: Error | null, result?: any) => any) {
    let err: Error | null = null
    let result: any

    // TODO: Figure out how to handle completion here.
    if (code === '.scope') {
      callback(err)
      return
    }

    try {
      result = _eval(service, state, code)
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

      console.error(err)
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
  if (undoInput.charAt(undoInput.length - 1) === '\n' && /^\s*[\/\[(`]/.test(input) && !/;\s*$/.test(undoInput)) {
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

if (require.main === module) {
  main(process.argv.slice(2))
}
