#!/usr/bin/env node

import { join, resolve } from 'path'
import { start, Recoverable } from 'repl'
import { inspect } from 'util'
import arrify = require('arrify')
import Module = require('module')
import minimist = require('minimist')
import { diffLines } from 'diff'
import { Script } from 'vm'
import { readFileSync, statSync } from 'fs'
import { register, VERSION, DEFAULTS, TSError, parse } from './index'

interface Argv {
  // Node.js-like options.
  eval?: string
  print?: string
  require?: string | string[]
  // CLI options.
  help?: boolean
  version?: boolean
  // Register options.
  pretty?: boolean
  typeCheck?: boolean
  transpileOnly?: boolean
  files?: boolean
  cache?: boolean
  cacheDirectory?: string
  compiler?: string
  ignore?: string | string[]
  project?: string
  scope?: string
  skipIgnore?: boolean
  skipProject?: boolean
  ignoreDiagnostics?: string | string[]
  compilerOptions?: string
  _: string[]
}

const argv = minimist<Argv>(process.argv.slice(2), {
  stopEarly: true,
  string: ['eval', 'print', 'compiler', 'project', 'scope', 'ignoreDiagnostics', 'require', 'cacheDirectory', 'ignore'],
  boolean: ['help', 'transpileOnly', 'typeCheck', 'version', 'files', 'cache', 'pretty', 'skipProject', 'skipIgnore'],
  alias: {
    eval: ['e'],
    print: ['p'],
    require: ['r'],
    help: ['h'],
    version: ['v'],
    typeCheck: ['type-check'],
    transpileOnly: ['T', 'transpile-only'],
    cacheDirectory: ['cache-directory'],
    ignore: ['I'],
    project: ['P'],
    scope: ['S'],
    skipIgnore: ['skip-ignore'],
    skipProject: ['skip-project'],
    compiler: ['C'],
    ignoreDiagnostics: ['D', 'ignore-diagnostics'],
    compilerOptions: ['O', 'compiler-options']
  },
  default: {
    cache: DEFAULTS.cache,
    files: DEFAULTS.files,
    pretty: DEFAULTS.pretty,
    typeCheck: DEFAULTS.typeCheck,
    transpileOnly: DEFAULTS.transpileOnly,
    cacheDirectory: DEFAULTS.cacheDirectory,
    ignore: DEFAULTS.ignore,
    project: DEFAULTS.project,
    skipIgnore: DEFAULTS.skipIgnore,
    skipProject: DEFAULTS.skipProject,
    compiler: DEFAULTS.compiler,
    ignoreDiagnostics: DEFAULTS.ignoreDiagnostics
  }
})

if (argv.help) {
  console.log(`
Usage: ts-node [options] [ -e script | script.ts ] [arguments]

Options:

  -e, --eval [code]              Evaluate code
  -p, --print [code]             Evaluate code and print result
  -r, --require [path]           Require a node module before execution

  -h, --help                     Print CLI usage
  -v, --version                  Print module version information

  -T, --transpile-only           Use TypeScript's faster \`transpileModule\`
  --cache-directory              Configure the output file cache directory
  -I, --ignore [pattern]         Override the path patterns to skip compilation
  -P, --project [path]           Path to TypeScript JSON project file
  -S, --scope [path]             Path to TypeScript project to register
  -C, --compiler [name]          Specify a custom TypeScript compiler
  -D, --ignoreDiagnostics [code] Ignore TypeScript warnings by diagnostic code
  -O, --compilerOptions [opts]   JSON object to merge with compiler options

  --files                        Load files from \`tsconfig.json\` on startup
  --pretty                       Use pretty diagnostic formatter
  --no-cache                     Disable the local TypeScript Node cache
  --skip-project                 Skip reading \`tsconfig.json\`
  --skip-ignore                  Skip \`--ignore\` checks
`)

  process.exit(0)
}

const cwd = process.cwd()
const code = argv.eval === undefined ? argv.print : argv.eval
const isEval = typeof argv.eval === 'string' || !!argv.print // Minimist struggles with empty strings.
const isPrinted = argv.print !== undefined

// Register the TypeScript compiler instance.
const service = register({
  files: argv.files,
  pretty: argv.pretty,
  typeCheck: argv.typeCheck,
  transpileOnly: argv.transpileOnly,
  cache: argv.cache,
  cacheDirectory: argv.cacheDirectory,
  ignore: argv.ignore,
  project: argv.project,
  scope: argv.scope,
  skipIgnore: argv.skipIgnore,
  skipProject: argv.skipProject,
  compiler: argv.compiler,
  ignoreDiagnostics: argv.ignoreDiagnostics,
  compilerOptions: parse(argv.compilerOptions) || DEFAULTS.compilerOptions,
  readFile: isEval ? readFileEval : undefined,
  fileExists: isEval ? fileExistsEval : undefined
})

// Output project information.
if (argv.version) {
  console.log(`ts-node v${VERSION}`)
  console.log(`node ${process.version}`)
  console.log(`typescript v${service.ts.version}`)
  console.log(`cache ${JSON.stringify(service.cachedir)}`)
  process.exit(0)
}

// Require specified modules before start-up.
(Module as any)._preloadModules(arrify(argv.require))

/**
 * Eval helpers.
 */
const EVAL_FILENAME = `[eval].ts`
const EVAL_PATH = join(cwd, EVAL_FILENAME)
const EVAL_INSTANCE = { input: '', output: '', version: 0, lines: 0 }

// Execute the main contents (either eval, script or piped).
if (isEval) {
  evalAndExit(code as string, isPrinted)
} else {
  if (argv._.length) {
    process.argv = ['node'].concat(resolve(cwd, argv._[0])).concat(argv._.slice(1))
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

      repl.outputStream.write(`${name}\n${comment ? `${comment}\n` : ''}`)
      repl.displayPrompt()
    }
  })
}

/**
 * Eval code from the REPL.
 */
function replEval (code: string, _context: any, _filename: string, callback: (err?: Error, result?: any) => any) {
  let err: Error | undefined
  let result: any

  // TODO: Figure out how to handle completion here.
  if (code === '.scope') {
    callback()
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
        err = undefined
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
