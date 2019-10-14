#!/usr/bin/env node

import { join, resolve } from 'path'
import { start, Recoverable } from 'repl'
import { inspect } from 'util'
import Module = require('module')
import arg = require('arg')
import { diffLines } from 'diff'
import { Script } from 'vm'
import { readFileSync, statSync } from 'fs'
import { register, VERSION, DEFAULTS, TSError, parse } from './index'

const args = arg({
  // Node.js-like options.
  '--eval': String,
  '--print': Boolean,
  '--require': [String],

  // CLI options.
  '--files': Boolean,
  '--help': Boolean,
  '--version': arg.COUNT,

  // Project options.
  '--compiler': String,
  '--compiler-options': parse,
  '--project': String,
  '--ignore-diagnostics': [String],
  '--ignore': [String],
  '--transpile-only': Boolean,
  '--type-check': Boolean,
  '--pretty': Boolean,
  '--skip-project': Boolean,
  '--skip-ignore': Boolean,
  '--prefer-ts-exts': Boolean,
  '--log-error': Boolean,
  '--build': Boolean,

  // Aliases.
  '-e': '--eval',
  '-p': '--print',
  '-r': '--require',
  '-h': '--help',
  '-v': '--version',
  '-B': '--build',
  '-T': '--transpile-only',
  '-I': '--ignore',
  '-P': '--project',
  '-C': '--compiler',
  '-D': '--ignore-diagnostics',
  '-O': '--compiler-options'
}, {
  stopAtPositional: true
})

const {
  '--help': help = false,
  '--version': version = 0,
  '--files': files = DEFAULTS.files,
  '--compiler': compiler = DEFAULTS.compiler,
  '--compiler-options': compilerOptions = DEFAULTS.compilerOptions,
  '--project': project = DEFAULTS.project,
  '--ignore-diagnostics': ignoreDiagnostics = DEFAULTS.ignoreDiagnostics,
  '--ignore': ignore = DEFAULTS.ignore,
  '--transpile-only': transpileOnly = DEFAULTS.transpileOnly,
  '--type-check': typeCheck = DEFAULTS.typeCheck,
  '--pretty': pretty = DEFAULTS.pretty,
  '--skip-project': skipProject = DEFAULTS.skipProject,
  '--skip-ignore': skipIgnore = DEFAULTS.skipIgnore,
  '--prefer-ts-exts': preferTsExts = DEFAULTS.preferTsExts,
  '--log-error': logError = DEFAULTS.logError,
  '--build': build = DEFAULTS.build
} = args

if (help) {
  console.log(`
Usage: ts-node [options] [ -e script | script.ts ] [arguments]

Options:

  -e, --eval [code]              Evaluate code
  -p, --print                    Print result of \`--eval\`
  -r, --require [path]           Require a node module before execution

  -h, --help                     Print CLI usage
  -v, --version                  Print module version information

  -T, --transpile-only           Use TypeScript's faster \`transpileModule\`
  -I, --ignore [pattern]         Override the path patterns to skip compilation
  -P, --project [path]           Path to TypeScript JSON project file
  -C, --compiler [name]          Specify a custom TypeScript compiler
  -D, --ignore-diagnostics [code] Ignore TypeScript warnings by diagnostic code
  -O, --compiler-options [opts]   JSON object to merge with compiler options

  --files                        Load files from \`tsconfig.json\` on startup
  --pretty                       Use pretty diagnostic formatter
  --skip-project                 Skip reading \`tsconfig.json\`
  --skip-ignore                  Skip \`--ignore\` checks
  --prefer-ts-exts               Prefer importing TypeScript files over JavaScript files
`)

  process.exit(0)
}

// Output project information.
if (version === 1) {
  console.log(`v${VERSION}`)
  process.exit(0)
}

const cwd = process.cwd()
const code = args['--eval']
const isPrinted = args['--print'] !== undefined

/**
 * Eval helpers.
 */
const EVAL_FILENAME = `[eval].ts`
const EVAL_PATH = join(cwd, EVAL_FILENAME)
const EVAL_INSTANCE = { input: '', output: '', version: 0, lines: 0 }

// Register the TypeScript compiler instance.
const service = register({
  build,
  files,
  pretty,
  typeCheck,
  transpileOnly,
  ignore,
  project,
  preferTsExts,
  logError,
  skipProject,
  skipIgnore,
  compiler,
  ignoreDiagnostics,
  compilerOptions,
  readFile: code ? readFileEval : undefined,
  fileExists: code ? fileExistsEval : undefined
})

// Output project information.
if (version >= 2) {
  console.log(`ts-node v${VERSION}`)
  console.log(`node ${process.version}`)
  console.log(`compiler v${service.ts.version}`)
  process.exit(0)
}

// Require specified modules before start-up.
if (args['--require']) (Module as any)._preloadModules(args['--require'])

// Prepend `ts-node` arguments to CLI for child processes.
process.execArgv.unshift(__filename, ...process.argv.slice(2, process.argv.length - args._.length))
process.argv = [process.argv[1]].concat(args._.length ? resolve(cwd, args._[0]) : []).concat(args._.slice(1))

// Execute the main contents (either eval, script or piped).
if (code) {
  evalAndExit(code, isPrinted)
} else {
  if (args._.length) {
    Module.runMain()
  } else {
    // Piping of execution _only_ occurs when no other script is specified.
    if (process.stdin.isTTY) {
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
  module.paths = (Module as any)._nodeModulePaths(cwd)

  ;(global as any).__filename = EVAL_FILENAME
  ;(global as any).__dirname = cwd
  ;(global as any).exports = module.exports
  ;(global as any).module = module
  ;(global as any).require = module.require.bind(module)

  let result: any

  try {
    result = _eval(code)
  } catch (error) {
    if (error instanceof TSError) {
      console.error(error.diagnosticText)
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
function _eval (input: string) {
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
    return change.added ? exec(change.value, EVAL_FILENAME) : result
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
function startRepl () {
  const repl = start({
    prompt: '> ',
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdout.isTTY,
    eval: replEval,
    useGlobal: true
  })

  // Bookmark the point where we should reset the REPL state.
  const resetEval = appendEval('')

  function reset () {
    resetEval()

    // Hard fix for TypeScript forcing `Object.defineProperty(exports, ...)`.
    exec('exports = module.exports', EVAL_FILENAME)
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

      if (name) repl.outputStream.write(`${name}\n`)
      if (comment) repl.outputStream.write(`${comment}\n`)
      repl.displayPrompt()
    }
  })
}

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
    result = _eval(code)
  } catch (error) {
    if (error instanceof TSError) {
      // Support recoverable compilations using >= node 6.
      if (Recoverable && isRecoverable(error)) {
        err = new Recoverable(error)
      } else {
        console.error(error.diagnosticText)
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
function readFileEval (path: string) {
  if (path === EVAL_PATH) return EVAL_INSTANCE.input

  try {
    return readFileSync(path, 'utf8')
  } catch (err) {/* Ignore. */}
}

/**
 * Get whether the file exists.
 */
function fileExistsEval (path: string) {
  if (path === EVAL_PATH) return true

  try {
    const stats = statSync(path)
    return stats.isFile() || stats.isFIFO()
  } catch (err) {
    return false
  }
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
