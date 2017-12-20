import v8flags = require('v8flags')
import minimist = require('minimist')
import { isAbsolute, sep } from 'path'

/**
 * Print help output, and exit
 */
function printHelpAndExit (exitCode: number = 0) {
  console.log(`
Usage: ts-node [options] [ -e script | script.ts ] [arguments]

Options:

  -e, --eval [code]              Evaluate code
  -p, --print [code]             Evaluate code and print result
  -r, --require [path]           Require a node module for execution
  -C, --compiler [name]          Specify a custom TypeScript compiler
  -I, --ignoreWarnings [code]    Ignore TypeScript warnings by diagnostic code
  -P, --project [path]           Path to TypeScript project (or \`false\`)
  -O, --compilerOptions [opts]   JSON object to merge with compiler options
  -F, --fast                     Run TypeScript compilation in transpile mode
  --ignore [regexp], --no-ignore Set the ignore check (default: \`/node_modules/\`)
  --no-cache                     Disable the TypeScript cache
  --cache-directory              Configure the TypeScript cache directory
`)

  process.exit(exitCode)
}

/**
 * Interface representing the arguments that can be fed to ts-node
 */
export interface ITSNodeArgs {
  eval?: string
  print?: string
  typeCheck?: boolean
  cache?: boolean
  cacheDirectory?: string
  version?: boolean
  help?: boolean
  compiler?: string
  project?: string
  require?: string | string[]
  ignore?: boolean | string | string[]
  ignoreWarnings?: string | string[]
  compilerOptions?: any
  _: string[]
}

/**
 * Configuration used by minimist to extract ts-node flags
 */
const MINIMIST_CONFIGURATION = {
  string: ['eval', 'print', 'compiler', 'project', 'ignoreWarnings', 'require', 'cacheDirectory', 'ignore'],
  boolean: ['help', 'typeCheck', 'version', 'cache'],
  alias: {
    help: ['h'],
    version: ['v'],
    eval: ['e'],
    print: ['p'],
    project: ['P'],
    compiler: ['C'],
    require: ['r'],
    typeCheck: ['type-check'],
    cacheDirectory: ['cache-directory'],
    ignoreWarnings: ['I', 'ignore-warnings'],
    compilerOptions: ['O', 'compiler-options']
  },
  default: {
    cache: null,
    typeCheck: null
  }
}

/**
 * Strip node flags from the current list of arguments
 *
 * @param v8flags V8 flags to strip
 * @param argv  current list of arguments
 */
function filterNodeArgv (v8flags: string[], argv: string[]) {
  let pos = 0

  for (const arg of argv) {
    const flag = arg.split('=', 1)[0]

    if (v8flags.indexOf(flag) > -1) {
      argv.splice(pos, 1)
    } else {
      pos += 1
    }
  }

  return argv
}

/**
 * Extract the list of flags that are meant
 * for Node itself
 *
 * @param argv
 */
export async function filterNodeFlags (argv: string[]) {
  return new Promise<string[]>((resolve, reject) => {
    v8flags((error, v8flags) => {
      if (error) {
        return reject(error)
      }

      resolve(v8flags)
    })
  }).then((v8flags) => v8flags.concat([
    'debug',
    'inspect',
    '--debug',
    '--debug-brk',
    '--inspect',
    '--inspect-brk',
    '--nolazy',
    '--no-deprecation',
    '--log-timer-events',
    '--throw-deprecation',
    '--trace-deprecation',
    '--allow-natives-syntax',
    '--perf-basic-prof',
    '--preserve-symlinks',
    '--expose-gc',
    '--expose-http2',
    '--trace-warnings'
  ])).then((v8flags) => filterNodeArgv(v8flags, argv))
}

/**
 * Extract and separate ts-node arguments from arguments to be passed
 * to the application
 *
 * @param argv
 */
export function extractArgv (argv: string[]) {
  //
  const tsNodeArgs: ITSNodeArgs = minimist(argv, MINIMIST_CONFIGURATION)

  const scriptArgs: string[] = tsNodeArgs._
  let scriptFile: string = ''

  if (scriptArgs[0] && scriptArgs[0][0] !== '-') {
    scriptFile = scriptArgs.shift() as string
    if (!isAbsolute(scriptFile) && scriptFile[0] !== '.') {
      scriptFile = '.' + sep + scriptFile
    }
  }

  if (tsNodeArgs.help) {
    return printHelpAndExit()
  }

  return {
    tsNodeArgs,
    scriptFile,
    scriptArgs
  }
}
