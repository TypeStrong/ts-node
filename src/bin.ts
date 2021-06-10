#!/usr/bin/env node

import { join, resolve, dirname, parse as parsePath } from 'path';
import { inspect } from 'util';
import Module = require('module');
import arg = require('arg');
import { parse, createRequire, hasOwnProperty } from './util';
import {
  EVAL_FILENAME,
  EvalState,
  createRepl,
  ReplService,
  setContext,
  STDIN_FILENAME,
  EvalAwarePartialHost,
  EVAL_NAME,
  STDIN_NAME,
  REPL_FILENAME,
} from './repl';
import { VERSION, TSError, register } from './index';
import type { TSInternal } from './ts-compiler-types';
import { addBuiltinLibsToObject } from '../dist-raw/node-cjs-helpers';

/**
 * Main `bin` functionality.
 */
export function main(
  argv: string[] = process.argv.slice(2),
  entrypointArgs: Record<string, any> = {}
) {
  const args = {
    ...entrypointArgs,
    ...arg(
      {
        // Node.js-like options.
        '--eval': String,
        '--interactive': Boolean,
        '--print': Boolean,
        '--require': [String],

        // CLI options.
        '--help': Boolean,
        '--cwd-mode': Boolean,
        '--script-mode': Boolean,
        '--version': arg.COUNT,
        '--show-config': Boolean,

        // Project options.
        '--cwd': String,
        '--files': Boolean,
        '--compiler': String,
        '--compiler-options': parse,
        '--project': String,
        '--ignore-diagnostics': [String],
        '--ignore': [String],
        '--transpile-only': Boolean,
        '--transpiler': String,
        '--type-check': Boolean,
        '--compiler-host': Boolean,
        '--pretty': Boolean,
        '--skip-project': Boolean,
        '--skip-ignore': Boolean,
        '--prefer-ts-exts': Boolean,
        '--log-error': Boolean,
        '--emit': Boolean,
        '--scope': Boolean,
        '--scope-dir': String,

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
        '-O': '--compiler-options',
        '--dir': '--cwd',
        '--showConfig': '--show-config',
        '--scopeDir': '--scope-dir',
      },
      {
        argv,
        stopAtPositional: true,
      }
    ),
  };

  // Only setting defaults for CLI-specific flags
  // Anything passed to `register()` can be `undefined`; `create()` will apply
  // defaults.
  const {
    '--cwd': cwdArg,
    '--help': help = false,
    '--script-mode': scriptMode,
    '--cwd-mode': cwdMode,
    '--version': version = 0,
    '--show-config': showConfig,
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
    '--transpiler': transpiler,
    '--compiler-host': compilerHost,
    '--pretty': pretty,
    '--skip-project': skipProject,
    '--skip-ignore': skipIgnore,
    '--prefer-ts-exts': preferTsExts,
    '--log-error': logError,
    '--emit': emit,
    '--scope': scope = undefined,
    '--scope-dir': scopeDir = undefined,
  } = args;

  if (help) {
    console.log(`
  Usage: ts-node [options] [ -e script | script.ts ] [arguments]

  Options:

    -e, --eval [code]               Evaluate code
    -p, --print                     Print result of \`--eval\`
    -r, --require [path]            Require a node module before execution
    -i, --interactive               Opens the REPL even if stdin does not appear to be a terminal

    -h, --help                      Print CLI usage
    -v, --version                   Print module version information
    --cwd-mode                      Use current directory instead of <script.ts> for config resolution
    --show-config                   Print resolved configuration and exit

    -T, --transpile-only            Use TypeScript's faster \`transpileModule\` or a third-party transpiler
    -H, --compiler-host             Use TypeScript's compiler host API
    -I, --ignore [pattern]          Override the path patterns to skip compilation
    -P, --project [path]            Path to TypeScript JSON project file
    -C, --compiler [name]           Specify a custom TypeScript compiler
    --transpiler [name]             Specify a third-party, non-typechecking transpiler
    -D, --ignore-diagnostics [code] Ignore TypeScript warnings by diagnostic code
    -O, --compiler-options [opts]   JSON object to merge with compiler options

    --cwd                           Behave as if invoked within this working directory.
    --files                         Load \`files\`, \`include\` and \`exclude\` from \`tsconfig.json\` on startup
    --pretty                        Use pretty diagnostic formatter (usually enabled by default)
    --skip-project                  Skip reading \`tsconfig.json\`
    --skip-ignore                   Skip \`--ignore\` checks
    --scope                         Scope compiler to files within \`scopeDir\`.  Anything outside this directory is ignored.
    --scope-dir                     Directory for \`--scope\`
    --prefer-ts-exts                Prefer importing TypeScript files over JavaScript files
    --log-error                     Logs TypeScript errors to stderr instead of throwing exceptions
  `);

    process.exit(0);
  }

  // Output project information.
  if (version === 1) {
    console.log(`v${VERSION}`);
    process.exit(0);
  }

  // Figure out which we are executing: piped stdin, --eval, REPL, and/or entrypoint
  // This is complicated because node's behavior is complicated
  // `node -e code -i ./script.js` ignores -e
  const executeEval = code != null && !(interactive && args._.length);
  const executeEntrypoint = !executeEval && args._.length > 0;
  const executeRepl =
    !executeEntrypoint &&
    (interactive || (process.stdin.isTTY && !executeEval));
  const executeStdin = !executeEval && !executeRepl && !executeEntrypoint;

  const cwd = cwdArg || process.cwd();
  /** Unresolved.  May point to a symlink, not realpath.  May be missing file extension */
  const scriptPath = executeEntrypoint ? resolve(cwd, args._[0]) : undefined;

  /**
   * <repl>, [stdin], and [eval] are all essentially virtual files that do not exist on disc and are backed by a REPL
   * service to handle eval-ing of code.
   */
  interface VirtualFileState {
    state: EvalState;
    repl: ReplService;
    module?: Module;
  }
  let evalStuff: VirtualFileState | undefined;
  let replStuff: VirtualFileState | undefined;
  let stdinStuff: VirtualFileState | undefined;
  // let evalService: ReplService | undefined;
  // let replState: EvalState | undefined;
  // let replService: ReplService | undefined;
  // let stdinState: EvalState | undefined;
  // let stdinService: ReplService | undefined;
  let evalAwarePartialHost: EvalAwarePartialHost | undefined = undefined;
  if (executeEval) {
    const state = new EvalState(join(cwd, EVAL_FILENAME));
    evalStuff = {
      state,
      repl: createRepl({
        state,
        composeWithEvalAwarePartialHost: evalAwarePartialHost,
      }),
    };
    ({ evalAwarePartialHost } = evalStuff.repl);
    // Create a local module instance based on `cwd`.
    const module = (evalStuff.module = new Module(EVAL_NAME));
    module.filename = evalStuff.state.path;
    module.paths = (Module as any)._nodeModulePaths(cwd);
  }
  if (executeStdin) {
    const state = new EvalState(join(cwd, STDIN_FILENAME));
    stdinStuff = {
      state,
      repl: createRepl({
        state,
        composeWithEvalAwarePartialHost: evalAwarePartialHost,
      }),
    };
    ({ evalAwarePartialHost } = stdinStuff.repl);
    // Create a local module instance based on `cwd`.
    const module = (stdinStuff.module = new Module(STDIN_NAME));
    module.filename = stdinStuff.state.path;
    module.paths = (Module as any)._nodeModulePaths(cwd);
  }
  if (executeRepl) {
    const state = new EvalState(join(cwd, REPL_FILENAME));
    replStuff = {
      state,
      repl: createRepl({
        state,
        composeWithEvalAwarePartialHost: evalAwarePartialHost,
      }),
    };
    ({ evalAwarePartialHost } = replStuff.repl);
  }

  // Register the TypeScript compiler instance.
  const service = register({
    cwd,
    emit,
    files,
    pretty,
    transpileOnly: transpileOnly ?? transpiler != null ? true : undefined,
    typeCheck,
    transpiler,
    compilerHost,
    ignore,
    preferTsExts,
    logError,
    projectSearchDir: getProjectSearchDir(cwd, scriptMode, cwdMode, scriptPath),
    project,
    skipProject,
    skipIgnore,
    compiler,
    ignoreDiagnostics,
    compilerOptions,
    require: argsRequire,
    readFile: evalAwarePartialHost?.readFile ?? undefined,
    fileExists: evalAwarePartialHost?.fileExists ?? undefined,
    scope,
    scopeDir,
  });

  // Bind REPL service to ts-node compiler service (chicken-and-egg problem)
  replStuff?.repl.setService(service);
  evalStuff?.repl.setService(service);
  stdinStuff?.repl.setService(service);

  // Output project information.
  if (version >= 2) {
    console.log(`ts-node v${VERSION}`);
    console.log(`node ${process.version}`);
    console.log(`compiler v${service.ts.version}`);
    process.exit(0);
  }

  if (showConfig) {
    const ts = (service.ts as any) as TSInternal;
    if (typeof ts.convertToTSConfig !== 'function') {
      console.error(
        'Error: --show-config requires a typescript versions >=3.2 that support --showConfig'
      );
      process.exit(1);
    }
    const json = {
      ['ts-node']: {
        ...service.options,
        optionBasePaths: undefined,
        experimentalEsmLoader: undefined,
        compilerOptions: undefined,
        project: service.configFilePath ?? service.options.project,
      },
      ...ts.convertToTSConfig(
        service.config,
        service.configFilePath ?? join(cwd, 'ts-node-implicit-tsconfig.json'),
        service.ts.sys
      ),
    };
    console.log(
      // Assumes that all configuration options which can possibly be specified via the CLI are JSON-compatible.
      // If, in the future, we must log functions, for example readFile and fileExists, then we can implement a JSON
      // replacer function.
      JSON.stringify(json, null, 2)
    );
    process.exit(0);
  }

  // Prepend `ts-node` arguments to CLI for child processes.
  process.execArgv.unshift(
    __filename,
    ...process.argv.slice(2, process.argv.length - args._.length)
  );
  process.argv = [process.argv[1]]
    .concat(executeEntrypoint ? ([scriptPath] as string[]) : [])
    .concat(args._.slice(executeEntrypoint ? 1 : 0));

  // Execute the main contents (either eval, script or piped).
  if (executeEntrypoint) {
    Module.runMain();
  } else {
    if (executeEval) {
      addBuiltinLibsToObject(global);
      evalAndExitOnTsError(
        evalStuff!.repl,
        evalStuff!.module!,
        code!,
        print,
        'eval'
      );
    }
    if (executeRepl) {
      replStuff!.repl.start();
    }
    if (executeStdin) {
      let buffer = code || '';
      process.stdin.on('data', (chunk: Buffer) => (buffer += chunk));
      process.stdin.on('end', () => {
        evalAndExitOnTsError(
          stdinStuff!.repl,
          stdinStuff!.module!,
          buffer,
          // `echo 123 | node -p` still prints 123
          print,
          'stdin'
        );
      });
    }
  }
}

/**
 * Get project search path from args.
 */
function getProjectSearchDir(
  cwd?: string,
  scriptMode?: boolean,
  cwdMode?: boolean,
  scriptPath?: string
) {
  // Validate `--script-mode` / `--cwd-mode` / `--cwd` usage is correct.
  if (scriptMode && cwdMode) {
    throw new TypeError('--cwd-mode cannot be combined with --script-mode');
  }
  if (scriptMode && !scriptPath) {
    throw new TypeError(
      '--script-mode must be used with a script name, e.g. `ts-node --script-mode <script.ts>`'
    );
  }
  const doScriptMode =
    scriptMode === true ? true : cwdMode === true ? false : !!scriptPath;
  if (doScriptMode) {
    // Use node's own resolution behavior to ensure we follow symlinks.
    // scriptPath may omit file extension or point to a directory with or without package.json.
    // This happens before we are registered, so we tell node's resolver to consider ts, tsx, and jsx files.
    // In extremely rare cases, is is technically possible to resolve the wrong directory,
    // because we do not yet know preferTsExts, jsx, nor allowJs.
    // See also, justification why this will not happen in real-world situations:
    // https://github.com/TypeStrong/ts-node/pull/1009#issuecomment-613017081
    const exts = ['.js', '.jsx', '.ts', '.tsx'];
    const extsTemporarilyInstalled: string[] = [];
    for (const ext of exts) {
      if (!hasOwnProperty(require.extensions, ext)) {
        extsTemporarilyInstalled.push(ext);
        require.extensions[ext] = function () {};
      }
    }
    try {
      return dirname(requireResolveNonCached(scriptPath!));
    } finally {
      for (const ext of extsTemporarilyInstalled) {
        delete require.extensions[ext];
      }
    }
  }

  return cwd;
}

const guaranteedNonexistentDirectoryPrefix = resolve(__dirname, 'doesnotexist');
let guaranteedNonexistentDirectorySuffix = 0;

/**
 * require.resolve an absolute path, tricking node into *not* caching the results.
 * Necessary so that we do not pollute require.resolve cache prior to installing require.extensions
 *
 * Is a terrible hack, because node does not expose the necessary cache invalidation APIs
 * https://stackoverflow.com/questions/59865584/how-to-invalidate-cached-require-resolve-results
 */
function requireResolveNonCached(absoluteModuleSpecifier: string) {
  // node 10 and 11 fallback: The trick below triggers a node 10 & 11 bug
  // On those node versions, pollute the require cache instead.  This is a deliberate
  // ts-node limitation that will *rarely* manifest, and will not matter once node 10
  // is end-of-life'd on 2021-04-30
  const isSupportedNodeVersion =
    parseInt(process.versions.node.split('.')[0], 10) >= 12;
  if (!isSupportedNodeVersion) return require.resolve(absoluteModuleSpecifier);

  const { dir, base } = parsePath(absoluteModuleSpecifier);
  const relativeModuleSpecifier = `./${base}`;

  const req = createRequire(
    join(dir, 'imaginaryUncacheableRequireResolveScript')
  );
  return req.resolve(relativeModuleSpecifier, {
    paths: [
      `${guaranteedNonexistentDirectoryPrefix}${guaranteedNonexistentDirectorySuffix++}`,
      ...(req.resolve.paths(relativeModuleSpecifier) || []),
    ],
  });
}

/**
 * Evaluate an [eval] or [stdin] script
 */
function evalAndExitOnTsError(
  replService: ReplService,
  module: Module,
  code: string,
  isPrinted: boolean,
  filenameAndDirname: 'eval' | 'stdin'
) {
  let result: any;
  setContext(global, module, filenameAndDirname);

  try {
    result = replService.evalCode(code);
  } catch (error) {
    if (error instanceof TSError) {
      console.error(error);
      process.exit(1);
    }

    throw error;
  }

  if (isPrinted) {
    console.log(
      typeof result === 'string'
        ? result
        : inspect(result, { colors: process.stdout.isTTY })
    );
  }
}

if (require.main === module) {
  main();
}
