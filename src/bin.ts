#!/usr/bin/env node

import { join, resolve, dirname } from 'path'
import { inspect } from 'util'
import Module = require('module')
import arg = require('arg')
import { readFileSync, statSync } from 'fs'
import {
  parse,
  Register,
  register,
  TSError,
  VERSION
} from './index'
import {
  EVAL_FILENAME,
  EvalState,
  createReplService,
  ReplService
 } from './repl'

/**
 * Main `bin` functionality.
 */
export function main (argv: string[] = process.argv.slice(2), entrypointArgs: Record<string, any> = {}) {
  const args = {
    ...entrypointArgs,
    ...arg({
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
  }

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
  /** Unresolved.  May point to a symlink, not realpath.  May be missing file extension */
  const scriptPath = args._.length ? resolve(cwd, args._[0]) : undefined
  const state = new EvalState(scriptPath || join(cwd, EVAL_FILENAME))
  const replService = createReplService({ state })
  const { evalStateAwareHostFunctions } = replService

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
    require: argsRequire,
    readFile: code !== undefined ? evalStateAwareHostFunctions.readFile : undefined,
    fileExists: code !== undefined ? evalStateAwareHostFunctions.fileExists : undefined
  })

  // Bind REPL service to ts-node compiler service (chicken-and-egg problem)
  replService.setService(service)

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

  // Prepend `ts-node` arguments to CLI for child processes.
  process.execArgv.unshift(__filename, ...process.argv.slice(2, process.argv.length - args._.length))
  process.argv = [process.argv[1]].concat(scriptPath || []).concat(args._.slice(1))

  // Execute the main contents (either eval, script or piped).
  if (code !== undefined && !interactive) {
    evalAndExit(replService, module, code, print)
  } else {
    if (args._.length) {
      Module.runMain()
    } else {
      // Piping of execution _only_ occurs when no other script is specified.
      // --interactive flag forces REPL
      if (interactive || process.stdin.isTTY) {
        replService.start(code)
      } else {
        let buffer = code || ''
        process.stdin.on('data', (chunk: Buffer) => buffer += chunk)
        process.stdin.on('end', () => evalAndExit(replService, module, buffer, print))
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

    // Use node's own resolution behavior to ensure we follow symlinks.
    // scriptPath may omit file extension or point to a directory with or without package.json.
    // This happens before we are registered, so we tell node's resolver to consider ts, tsx, and jsx files.
    // In extremely rare cases, is is technically possible to resolve the wrong directory,
    // because we do not yet know preferTsExts, jsx, nor allowJs.
    // See also, justification why this will not happen in real-world situations:
    // https://github.com/TypeStrong/ts-node/pull/1009#issuecomment-613017081
    const exts = ['.js', '.jsx', '.ts', '.tsx']
    const extsTemporarilyInstalled: string[] = []
    for (const ext of exts) {
      if (!hasOwnProperty(require.extensions, ext)) { // tslint:disable-line
        extsTemporarilyInstalled.push(ext)
        require.extensions[ext] = function() {} // tslint:disable-line
      }
    }
    try {
      return dirname(require.resolve(scriptPath))
    } finally {
      for (const ext of extsTemporarilyInstalled) {
        delete require.extensions[ext] // tslint:disable-line
      }
    }
  }

  return dir
}

/**
 * Evaluate a script.
 */
function evalAndExit (replService: ReplService, module: Module, code: string, isPrinted: boolean) {
  let result: any

  ;(global as any).__filename = module.filename
  ;(global as any).__dirname = dirname(module.filename)
  ;(global as any).exports = module.exports
  ;(global as any).module = module
  ;(global as any).require = module.require.bind(module)

  try {
    result = replService.evalCode(code)
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

/** Safe `hasOwnProperty` */
function hasOwnProperty (object: any, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, property)
}

if (require.main === module) {
  main()
}
