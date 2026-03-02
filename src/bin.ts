#!/usr/bin/env node

import { join, resolve, dirname, parse as parsePath, relative } from 'path';
import { inspect } from 'util';
import Module = require('module');
let arg: typeof import('arg');
import { parse, hasOwnProperty, versionGteLt } from './util';
import {
  EVAL_FILENAME,
  EvalState,
  createRepl,
  ReplService,
  setupContext,
  STDIN_FILENAME,
  EvalAwarePartialHost,
  EVAL_NAME,
  STDIN_NAME,
  REPL_FILENAME,
} from './repl';
import {
  VERSION,
  TSError,
  register,
  createEsmHooks,
  createFromPreloadedConfig,
  DEFAULTS,
  ExperimentalSpecifierResolution,
} from './index';
import type { TSInternal } from './ts-compiler-types';
import { addBuiltinLibsToObject } from '../dist-raw/node-internal-modules-cjs-helpers';
import { callInChild } from './child/spawn-child';
import { findAndReadConfig } from './configuration';

/**
 * Main `bin` functionality.
 *
 * This file is split into a chain of functions (phases), each one adding to a shared state object.
 * This is done so that the next function can either be invoked in-process or, if necessary, invoked in a child process.
 *
 * The functions are intentionally given uncreative names and left in the same order as the original code, to make a
 * smaller git diff.
 *
 * @internal
 */
export function main(argv: string[] = process.argv.slice(2), entrypointArgs: Record<string, any> = {}) {
  const args = parseArgv(argv, entrypointArgs);
  const state: BootstrapState = {
    shouldUseChildProcess: false,
    isInChildProcess: false,
    isCli: true,
    tsNodeScript: __filename,
    parseArgvResult: args,
  };
  return bootstrap(state);
}

/**
 * @internal
 * Describes state of CLI bootstrapping.
 * Can be marshalled when necessary to resume bootstrapping in a child process.
 */
export interface BootstrapState {
  isInChildProcess: boolean;
  shouldUseChildProcess: boolean;
  /**
   * True if bootstrapping the ts-node CLI process or the direct child necessitated by `--esm`.
   * false if bootstrapping a subsequently `fork()`ed child.
   */
  isCli: boolean;
  tsNodeScript: string;
  parseArgvResult: ReturnType<typeof parseArgv>;
  phase2Result?: ReturnType<typeof phase2>;
  phase3Result?: ReturnType<typeof phase3>;
}

/** @internal */
export function bootstrap(state: BootstrapState) {
  if (!state.phase2Result) {
    state.phase2Result = phase2(state);
    if (state.shouldUseChildProcess && !state.isInChildProcess) {
      // Note: When transitioning into the child-process after `phase2`,
      // the updated working directory needs to be preserved.
      return callInChild(state);
    }
  }
  if (!state.phase3Result) {
    state.phase3Result = phase3(state);
    if (state.shouldUseChildProcess && !state.isInChildProcess) {
      // Note: When transitioning into the child-process after `phase2`,
      // the updated working directory needs to be preserved.
      return callInChild(state);
    }
  }
  return phase4(state);
}

function parseArgv(argv: string[], entrypointArgs: Record<string, any>) {
  arg ??= require('arg');

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
        '--cwdMode': Boolean,
        '--scriptMode': Boolean,
        '--version': arg.COUNT,
        '--showConfig': Boolean,
        '--esm': Boolean,

        // Project options.
        '--cwd': String,
        '--files': Boolean,
        '--compiler': String,
        '--compilerOptions': parse,
        '--project': String,
        '--ignoreDiagnostics': [String],
        '--ignore': [String],
        '--transpileOnly': Boolean,
        '--transpiler': String,
        '--swc': Boolean,
        '--typeCheck': Boolean,
        '--compilerHost': Boolean,
        '--pretty': Boolean,
        '--skipProject': Boolean,
        '--skipIgnore': Boolean,
        '--preferTsExts': Boolean,
        '--logError': Boolean,
        '--emit': Boolean,
        '--scope': Boolean,
        '--scopeDir': String,
        '--noExperimentalReplAwait': Boolean,
        '--experimentalSpecifierResolution': String,

        // Aliases.
        '-e': '--eval',
        '-i': '--interactive',
        '-p': '--print',
        '-r': '--require',
        '-h': '--help',
        '-s': '--script-mode',
        '-v': '--version',
        '-T': '--transpileOnly',
        '-H': '--compilerHost',
        '-I': '--ignore',
        '-P': '--project',
        '-C': '--compiler',
        '-D': '--ignoreDiagnostics',
        '-O': '--compilerOptions',
        '--dir': '--cwd',

        // Support both tsc-style camelCase and node-style hypen-case for *all* flags
        '--cwd-mode': '--cwdMode',
        '--script-mode': '--scriptMode',
        '--show-config': '--showConfig',
        '--compiler-options': '--compilerOptions',
        '--ignore-diagnostics': '--ignoreDiagnostics',
        '--transpile-only': '--transpileOnly',
        '--type-check': '--typeCheck',
        '--compiler-host': '--compilerHost',
        '--skip-project': '--skipProject',
        '--skip-ignore': '--skipIgnore',
        '--prefer-ts-exts': '--preferTsExts',
        '--log-error': '--logError',
        '--scope-dir': '--scopeDir',
        '--no-experimental-repl-await': '--noExperimentalReplAwait',
        '--experimental-specifier-resolution': '--experimentalSpecifierResolution',
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
    '--scriptMode': scriptMode,
    '--cwdMode': cwdMode,
    '--version': version = 0,
    '--showConfig': showConfig,
    '--require': argsRequire = [],
    '--eval': code = undefined,
    '--print': print = false,
    '--interactive': interactive = false,
    '--files': files,
    '--compiler': compiler,
    '--compilerOptions': compilerOptions,
    '--project': project,
    '--ignoreDiagnostics': ignoreDiagnostics,
    '--ignore': ignore,
    '--transpileOnly': transpileOnly,
    '--typeCheck': typeCheck,
    '--transpiler': transpiler,
    '--swc': swc,
    '--compilerHost': compilerHost,
    '--pretty': pretty,
    '--skipProject': skipProject,
    '--skipIgnore': skipIgnore,
    '--preferTsExts': preferTsExts,
    '--logError': logError,
    '--emit': emit,
    '--scope': scope = undefined,
    '--scopeDir': scopeDir = undefined,
    '--noExperimentalReplAwait': noExperimentalReplAwait,
    '--experimentalSpecifierResolution': experimentalSpecifierResolution,
    '--esm': esm,
    _: restArgs,
  } = args;
  return {
    // Note: argv and restArgs may be overwritten by child process
    argv: process.argv,
    restArgs,

    cwdArg,
    help,
    scriptMode,
    cwdMode,
    version,
    showConfig,
    argsRequire,
    code,
    print,
    interactive,
    files,
    compiler,
    compilerOptions,
    project,
    ignoreDiagnostics,
    ignore,
    transpileOnly,
    typeCheck,
    transpiler,
    swc,
    compilerHost,
    pretty,
    skipProject,
    skipIgnore,
    preferTsExts,
    logError,
    emit,
    scope,
    scopeDir,
    noExperimentalReplAwait,
    experimentalSpecifierResolution,
    esm,
  };
}

function phase2(payload: BootstrapState) {
  const { help, version, cwdArg, esm } = payload.parseArgvResult;

  if (help) {
    console.log(`
Usage: ts-node [options] [ -e script | script.ts ] [arguments]

Options:

  -e, --eval [code]               Evaluate code
  -p, --print                     Print result of \`--eval\`
  -r, --require [path]            Require a node module before execution
  -i, --interactive               Opens the REPL even if stdin does not appear to be a terminal

  --esm                           Bootstrap with the ESM loader, enabling full ESM support
  --swc                           Use the faster swc transpiler

  -h, --help                      Print CLI usage
  -v, --version                   Print module version information.  -vvv to print additional information
  --showConfig                    Print resolved configuration and exit

  -T, --transpileOnly             Use TypeScript's faster \`transpileModule\` or a third-party transpiler
  -H, --compilerHost              Use TypeScript's compiler host API
  -I, --ignore [pattern]          Override the path patterns to skip compilation
  -P, --project [path]            Path to TypeScript JSON project file
  -C, --compiler [name]           Specify a custom TypeScript compiler
  --transpiler [name]             Specify a third-party, non-typechecking transpiler
  -D, --ignoreDiagnostics [code]  Ignore TypeScript warnings by diagnostic code
  -O, --compilerOptions [opts]    JSON object to merge with compiler options

  --cwd                           Behave as if invoked within this working directory.
  --files                         Load \`files\`, \`include\` and \`exclude\` from \`tsconfig.json\` on startup
  --pretty                        Use pretty diagnostic formatter (usually enabled by default)
  --cwdMode                       Use current directory instead of <script.ts> for config resolution
  --skipProject                   Skip reading \`tsconfig.json\`
  --skipIgnore                    Skip \`--ignore\` checks
  --emit                          Emit output files into \`.ts-node\` directory
  --scope                         Scope compiler to files within \`scopeDir\`.  Anything outside this directory is ignored.
  --scopeDir                      Directory for \`--scope\`
  --preferTsExts                  Prefer importing TypeScript files over JavaScript files
  --logError                      Logs TypeScript errors to stderr instead of throwing exceptions
  --noExperimentalReplAwait       Disable top-level await in REPL.  Equivalent to node's --no-experimental-repl-await
  --experimentalSpecifierResolution [node|explicit]
                                  Equivalent to node's --experimental-specifier-resolution
`);

    process.exit(0);
  }

  // Output project information.
  if (version === 1) {
    console.log(`v${VERSION}`);
    process.exit(0);
  }

  const cwd = cwdArg ? resolve(cwdArg) : process.cwd();

  // If ESM is explicitly enabled through the flag, stage3 should be run in a child process
  // with the ESM loaders configured.
  if (esm) payload.shouldUseChildProcess = true;

  return {
    cwd,
  };
}

function phase3(payload: BootstrapState) {
  const {
    emit,
    files,
    pretty,
    transpileOnly,
    transpiler,
    noExperimentalReplAwait,
    typeCheck,
    swc,
    compilerHost,
    ignore,
    preferTsExts,
    logError,
    scriptMode,
    cwdMode,
    project,
    skipProject,
    skipIgnore,
    compiler,
    ignoreDiagnostics,
    compilerOptions,
    argsRequire,
    scope,
    scopeDir,
    esm,
    experimentalSpecifierResolution,
  } = payload.parseArgvResult;
  const { cwd } = payload.phase2Result!;

  // NOTE: When we transition to a child process for ESM, the entry-point script determined
  // here might not be the one used later in `phase4`. This can happen when we execute the
  // original entry-point but then the process forks itself using e.g. `child_process.fork`.
  // We will always use the original TS project in forked processes anyway, so it is
  // expected and acceptable to retrieve the entry-point information here in `phase2`.
  // See: https://github.com/TypeStrong/ts-node/issues/1812.
  const { entryPointPath } = getEntryPointInfo(payload);

  const preloadedConfig = findAndReadConfig({
    cwd,
    emit,
    files,
    pretty,
    transpileOnly: transpileOnly ?? transpiler != null ? true : undefined,
    experimentalReplAwait: noExperimentalReplAwait ? false : undefined,
    typeCheck,
    transpiler,
    swc,
    compilerHost,
    ignore,
    logError,
    projectSearchDir: getProjectSearchDir(cwd, scriptMode, cwdMode, entryPointPath),
    project,
    skipProject,
    skipIgnore,
    compiler,
    ignoreDiagnostics,
    compilerOptions,
    require: argsRequire,
    scope,
    scopeDir,
    preferTsExts,
    esm,
    experimentalSpecifierResolution: experimentalSpecifierResolution as ExperimentalSpecifierResolution,
  });

  // If ESM is enabled through the parsed tsconfig, stage4 should be run in a child
  // process with the ESM loaders configured.
  if (preloadedConfig.options.esm) payload.shouldUseChildProcess = true;

  return { preloadedConfig };
}

/**
 * Determines the entry-point information from the argv and phase2 result. This
 * method will be invoked in two places:
 *
 *   1. In phase 3 to be able to find a project from the potential entry-point script.
 *   2. In phase 4 to determine the actual entry-point script.
 *
 * Note that we need to explicitly re-resolve the entry-point information in the final
 * stage because the previous stage information could be modified when the bootstrap
 * invocation transitioned into a child process for ESM.
 *
 * Stages before (phase 4) can and will be cached by the child process through the Brotli
 * configuration and entry-point information is only reliable in the final phase. More
 * details can be found in here: https://github.com/TypeStrong/ts-node/issues/1812.
 */
function getEntryPointInfo(state: BootstrapState) {
  const { code, interactive, restArgs } = state.parseArgvResult!;
  const { cwd } = state.phase2Result!;
  const { isCli } = state;

  // Figure out which we are executing: piped stdin, --eval, REPL, and/or entrypoint
  // This is complicated because node's behavior is complicated
  // `node -e code -i ./script.js` ignores -e
  const executeEval = code != null && !(interactive && restArgs.length);
  const executeEntrypoint = !executeEval && restArgs.length > 0;
  const executeRepl = !executeEntrypoint && (interactive || (process.stdin.isTTY && !executeEval));
  const executeStdin = !executeEval && !executeRepl && !executeEntrypoint;

  /**
   * Unresolved. May point to a symlink, not realpath. May be missing file extension
   * NOTE: resolution relative to cwd option (not `process.cwd()`) is legacy backwards-compat; should be changed in next major: https://github.com/TypeStrong/ts-node/issues/1834
   */
  const entryPointPath = executeEntrypoint ? (isCli ? resolve(cwd, restArgs[0]) : resolve(restArgs[0])) : undefined;

  return {
    executeEval,
    executeEntrypoint,
    executeRepl,
    executeStdin,
    entryPointPath,
  };
}

function phase4(payload: BootstrapState) {
  const { isInChildProcess, tsNodeScript } = payload;
  const { version, showConfig, restArgs, code, print, argv } = payload.parseArgvResult;
  const { cwd } = payload.phase2Result!;
  const { preloadedConfig } = payload.phase3Result!;

  const { entryPointPath, executeEntrypoint, executeEval, executeRepl, executeStdin } = getEntryPointInfo(payload);

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
  let evalAwarePartialHost: EvalAwarePartialHost | undefined = undefined;
  if (executeEval) {
    const state = new EvalState(join(cwd, EVAL_FILENAME));
    evalStuff = {
      state,
      repl: createRepl({
        state,
        composeWithEvalAwarePartialHost: evalAwarePartialHost,
        ignoreDiagnosticsThatAreAnnoyingInInteractiveRepl: false,
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
        ignoreDiagnosticsThatAreAnnoyingInInteractiveRepl: false,
      }),
    };
    ({ evalAwarePartialHost } = stdinStuff.repl);
    // Create a local module instance based on `cwd`.
    const module = (stdinStuff.module = new Module(STDIN_NAME));
    module.filename = stdinStuff.state.path;
    module.paths = (Module as any)._nodeModulePaths(cwd);
  }
  if (executeRepl) {
    // correct path is set later
    const state = new EvalState('');
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
  const service = createFromPreloadedConfig({
    // Since this struct may have been marshalled across thread or process boundaries, we must restore
    // un-marshall-able values.
    ...preloadedConfig,
    options: {
      ...preloadedConfig.options,
      readFile: evalAwarePartialHost?.readFile ?? undefined,
      fileExists: evalAwarePartialHost?.fileExists ?? undefined,
      tsTrace: DEFAULTS.tsTrace,
    },
  });
  register(service);

  if (replStuff) replStuff.state.path = join(cwd, REPL_FILENAME(service.ts.version));

  if (isInChildProcess)
    (require('./child/child-loader') as typeof import('./child/child-loader')).lateBindHooks(createEsmHooks(service));

  // Bind REPL service to ts-node compiler service (chicken-and-egg problem)
  replStuff?.repl.setService(service);
  evalStuff?.repl.setService(service);
  stdinStuff?.repl.setService(service);

  // Output project information.
  if (version === 2) {
    console.log(`ts-node v${VERSION}`);
    console.log(`node ${process.version}`);
    console.log(`compiler v${service.ts.version}`);
    process.exit(0);
  }
  if (version >= 3) {
    console.log(`ts-node v${VERSION} ${dirname(__dirname)}`);
    console.log(`node ${process.version}`);
    console.log(`compiler v${service.ts.version} ${service.compilerPath ?? ''}`);
    process.exit(0);
  }

  if (showConfig) {
    const ts = service.ts as any as TSInternal;
    if (typeof ts.convertToTSConfig !== 'function') {
      console.error('Error: --showConfig requires a typescript versions >=3.2 that support --showConfig');
      process.exit(1);
    }
    let moduleTypes = undefined;
    if (service.options.moduleTypes) {
      // Assumption: this codepath requires CLI invocation, so moduleTypes must have come from a tsconfig, not API.
      const showRelativeTo = dirname(service.configFilePath!);
      moduleTypes = {} as Record<string, string>;
      for (const [key, value] of Object.entries(service.options.moduleTypes)) {
        moduleTypes[relative(showRelativeTo, resolve(service.options.optionBasePaths?.moduleTypes!, key))] = value;
      }
    }
    const json = {
      ['ts-node']: {
        ...service.options,
        require: service.options.require?.length ? service.options.require : undefined,
        moduleTypes,
        optionBasePaths: undefined,
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
  process.execArgv.push(tsNodeScript, ...argv.slice(2, argv.length - restArgs.length));

  // TODO this comes from BootstrapState
  process.argv = [process.argv[1]]
    .concat(executeEntrypoint ? ([entryPointPath] as string[]) : [])
    .concat(restArgs.slice(executeEntrypoint ? 1 : 0));

  // Execute the main contents (either eval, script or piped).
  if (executeEntrypoint) {
    if (payload.isInChildProcess && versionGteLt(process.versions.node, '18.6.0', '18.7.0')) {
      // HACK workaround node regression
      require('../dist-raw/runmain-hack.js').run(entryPointPath);
    } else {
      Module.runMain();
    }
  } else {
    // Note: eval and repl may both run, but never with stdin.
    // If stdin runs, eval and repl will not.
    if (executeEval) {
      addBuiltinLibsToObject(global);
      evalAndExitOnTsError(evalStuff!.repl, evalStuff!.module!, code!, print, 'eval');
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
function getProjectSearchDir(cwd?: string, scriptMode?: boolean, cwdMode?: boolean, scriptPath?: string) {
  // Validate `--script-mode` / `--cwd-mode` / `--cwd` usage is correct.
  if (scriptMode && cwdMode) {
    throw new TypeError('--cwd-mode cannot be combined with --script-mode');
  }
  if (scriptMode && !scriptPath) {
    throw new TypeError('--script-mode must be used with a script name, e.g. `ts-node --script-mode <script.ts>`');
  }
  const doScriptMode = scriptMode === true ? true : cwdMode === true ? false : !!scriptPath;
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
  const { dir, base } = parsePath(absoluteModuleSpecifier);
  const relativeModuleSpecifier = `./${base}`;

  const req = Module.createRequire(join(dir, 'imaginaryUncacheableRequireResolveScript'));
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
  setupContext(global, module, filenameAndDirname);

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
    console.log(typeof result === 'string' ? result : inspect(result, { colors: process.stdout.isTTY }));
  }
}

if (require.main === module) {
  main();
}
