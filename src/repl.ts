import type * as _diff from 'diff';
import { homedir } from 'os';
import { join } from 'path';
import type * as _nodeRepl from 'repl';
import type { REPLServer, ReplOptions } from 'repl';
import { Context, createContext, Script } from 'vm';
import { Service, CreateOptions, TSError, env } from './index';
import { readFileSync, statSync } from 'fs';
import { Console } from 'console';
import * as assert from 'assert';
import type * as tty from 'tty';
import type * as Module from 'module';
import { builtinModules } from 'module';
import { tsSupportsMtsCtsExts } from './file-extensions';

// Lazy-loaded.
let _processTopLevelAwait: (src: string) => string | null;
function getProcessTopLevelAwait() {
  if (_processTopLevelAwait === undefined) {
    ({ processTopLevelAwait: _processTopLevelAwait } = require('../dist-raw/node-internal-repl-await'));
  }
  return _processTopLevelAwait;
}
let diff: typeof _diff;
function getDiffLines() {
  if (diff === undefined) {
    diff = require('diff');
  }
  return diff.diffLines;
}

// Lazy-loaded to prevent repl's require('domain') from causing problems
// https://github.com/TypeStrong/ts-node/issues/2024
// https://github.com/nodejs/node/issues/48131
let nodeRepl: typeof _nodeRepl;
function getNodeRepl() {
  if (nodeRepl === undefined) {
    nodeRepl = require('repl');
  }
  return nodeRepl;
}

/** @internal */
export const EVAL_FILENAME = `[eval].ts`;
/** @internal */
export const EVAL_NAME = `[eval]`;
/** @internal */
export const STDIN_FILENAME = `[stdin].ts`;
/** @internal */
export const STDIN_NAME = `[stdin]`;
/** @internal */
export function REPL_FILENAME(tsVersion: string) {
  return tsSupportsMtsCtsExts(tsVersion) ? '<repl>.cts' : '<repl>.ts';
}
/** @internal */
export const REPL_NAME = '<repl>';

export interface ReplService {
  readonly state: EvalState;
  /**
   * Bind this REPL to a ts-node compiler service.  A compiler service must be bound before `eval`-ing code or starting the REPL
   */
  setService(service: Service): void;
  /**
   * Append code to the virtual <repl> source file, compile it to JavaScript, throw semantic errors if the typechecker is enabled,
   * and execute it.
   *
   * Note: typically, you will want to call `start()` instead of using this method.
   *
   * @param code string of TypeScript.
   */
  evalCode(code: string): any;
  /** @internal */
  evalCodeInternal(opts: { code: string; enableTopLevelAwait?: boolean; context?: Context }):
    | {
        containsTopLevelAwait: true;
        valuePromise: Promise<any>;
      }
    | {
        containsTopLevelAwait: false;
        value: any;
      };
  /**
   * `eval` implementation compatible with node's REPL API
   *
   * Can be used in advanced scenarios if you want to manually create your own
   * node REPL instance and delegate eval to this `ReplService`.
   *
   * Example:
   *
   *     import {start} from 'repl';
   *     const replService: tsNode.ReplService = ...; // assuming you have already created a ts-node ReplService
   *     const nodeRepl = start({eval: replService.eval});
   */
  nodeEval(code: string, context: Context, _filename: string, callback: (err: Error | null, result?: any) => any): void;
  evalAwarePartialHost: EvalAwarePartialHost;
  /** Start a node REPL */
  start(): void;
  /**
   * Start a node REPL, evaling a string of TypeScript before it starts.
   * @deprecated
   */
  start(code: string): void;
  /** @internal */
  startInternal(opts?: ReplOptions): REPLServer;
  /** @internal */
  readonly stdin: NodeJS.ReadableStream;
  /** @internal */
  readonly stdout: NodeJS.WritableStream;
  /** @internal */
  readonly stderr: NodeJS.WritableStream;
  /** @internal */
  readonly console: Console;
}

/** @category REPL */
export interface CreateReplOptions {
  service?: Service;
  state?: EvalState;
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  stderr?: NodeJS.WritableStream;
  /** @internal */
  composeWithEvalAwarePartialHost?: EvalAwarePartialHost;
  /**
   * @internal
   * Ignore diagnostics that are annoying when interactively entering input line-by-line.
   */
  ignoreDiagnosticsThatAreAnnoyingInInteractiveRepl?: boolean;
}

interface StartReplInternalOptions extends ReplOptions {
  code?: string;
  forceToBeModule?: boolean;
}

/**
 * Create a ts-node REPL instance.
 *
 * Pay close attention to the example below.  Today, the API requires a few lines
 * of boilerplate to correctly bind the `ReplService` to the ts-node `Service` and
 * vice-versa.
 *
 * Usage example:
 *
 *     const repl = tsNode.createRepl();
 *     const service = tsNode.create({...repl.evalAwarePartialHost});
 *     repl.setService(service);
 *     repl.start();
 *
 * @category REPL
 */
export function createRepl(options: CreateReplOptions = {}) {
  const { ignoreDiagnosticsThatAreAnnoyingInInteractiveRepl = true } = options;
  let nodeReplServer: REPLServer;
  // If `useGlobal` is not true, then REPL creates a context when started.
  // This stores a reference to it or to `global`, whichever is used, after REPL has started.
  let context: Context | undefined;
  let state: EvalState;
  let mustSetStatePath = false;
  if (options.state) {
    state = options.state;
  } else {
    // Correct path set later
    state = new EvalState('');
    mustSetStatePath = true;
  }
  let service: Service;
  if (options.service) setService(options.service);
  const evalAwarePartialHost = createEvalAwarePartialHost(state, options.composeWithEvalAwarePartialHost);
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const _console = stdout === process.stdout && stderr === process.stderr ? console : new Console(stdout, stderr);

  const declaredExports = new Set();

  const replService: ReplService = {
    state: options.state ?? new EvalState(join(process.cwd(), EVAL_FILENAME)),
    setService,
    evalCode,
    evalCodeInternal,
    nodeEval,
    evalAwarePartialHost,
    start,
    startInternal,
    stdin,
    stdout,
    stderr,
    console: _console,
  };

  return replService;

  function setService(_service: Service) {
    service = _service;
    if (mustSetStatePath) state.path = join(process.cwd(), REPL_FILENAME(service.ts.version));
    if (ignoreDiagnosticsThatAreAnnoyingInInteractiveRepl) {
      service.addDiagnosticFilter({
        appliesToAllFiles: false,
        filenamesAbsolute: [state.path],
        diagnosticsIgnored: [
          2393, // Duplicate function implementation: https://github.com/TypeStrong/ts-node/issues/729
          6133, // <identifier> is declared but its value is never read. https://github.com/TypeStrong/ts-node/issues/850
          7027, // Unreachable code detected. https://github.com/TypeStrong/ts-node/issues/469
          ...(service.shouldReplAwait ? topLevelAwaitDiagnosticCodes : []),
        ],
      });
    }
  }

  // Hard fix for TypeScript forcing `Object.defineProperty(exports, ...)`.
  function declareExports() {
    if (declaredExports.has(context)) return;
    runInContext('exports = typeof module === "undefined" ? {} : module.exports;', state.path, context);
    declaredExports.add(context);
  }

  function evalCode(code: string) {
    declareExports();
    const result = appendCompileAndEvalInput({
      service: service!,
      state,
      input: code,
      context,
      overrideIsCompletion: false,
    });
    assert(result.containsTopLevelAwait === false);
    return result.value;
  }

  function evalCodeInternal(options: { code: string; enableTopLevelAwait?: boolean; context: Context }) {
    const { code, enableTopLevelAwait, context } = options;
    declareExports();
    return appendCompileAndEvalInput({
      service: service!,
      state,
      input: code,
      enableTopLevelAwait,
      context,
    });
  }

  function nodeEval(
    code: string,
    context: Context,
    _filename: string,
    callback: (err: Error | null, result?: any) => any
  ) {
    // TODO: Figure out how to handle completion here.
    if (code === '.scope') {
      callback(null);
      return;
    }

    try {
      const evalResult = evalCodeInternal({
        code,
        enableTopLevelAwait: true,
        context,
      });

      if (evalResult.containsTopLevelAwait) {
        (async () => {
          try {
            callback(null, await evalResult.valuePromise);
          } catch (promiseError) {
            handleError(promiseError);
          }
        })();
      } else {
        callback(null, evalResult.value);
      }
    } catch (error) {
      handleError(error);
    }

    // Log TSErrors, check if they're recoverable, log helpful hints for certain
    // well-known errors, and invoke `callback()`
    // TODO should evalCode API get the same error-handling benefits?
    function handleError(error: unknown) {
      // Don't show TLA hint if the user explicitly disabled repl top level await
      const canLogTopLevelAwaitHint = service!.options.experimentalReplAwait !== false && !service!.shouldReplAwait;
      if (error instanceof TSError) {
        // Support recoverable compilations using >= node 6.
        const { Recoverable } = getNodeRepl();
        if (Recoverable && isRecoverable(error)) {
          callback(new Recoverable(error));
          return;
        } else {
          _console.error(error);

          if (
            canLogTopLevelAwaitHint &&
            error.diagnosticCodes.some((dC) => topLevelAwaitDiagnosticCodes.includes(dC))
          ) {
            _console.error(getTopLevelAwaitHint());
          }
          callback(null);
        }
      } else {
        let _error = error as Error | undefined;
        if (
          canLogTopLevelAwaitHint &&
          _error instanceof SyntaxError &&
          _error.message?.includes('await is only valid')
        ) {
          try {
            // Only way I know to make our hint appear after the error
            _error.message += `\n\n${getTopLevelAwaitHint()}`;
            _error.stack = _error.stack?.replace(/(SyntaxError:.*)/, (_, $1) => `${$1}\n\n${getTopLevelAwaitHint()}`);
          } catch {}
        }
        callback(_error as Error);
      }
    }
    function getTopLevelAwaitHint() {
      return `Hint: REPL top-level await requires TypeScript version 3.8 or higher and target ES2018 or higher. You are using TypeScript ${
        service!.ts.version
      } and target ${service!.ts.ScriptTarget[service!.config.options.target!]}.`;
    }
  }

  // Note: `code` argument is deprecated
  function start(code?: string) {
    startInternal({ code });
  }

  // Note: `code` argument is deprecated
  function startInternal(options?: StartReplInternalOptions) {
    const { code, forceToBeModule = true, ...optionsOverride } = options ?? {};
    // TODO assert that `service` is set; remove all `service!` non-null assertions

    // Eval incoming code before the REPL starts.
    // Note: deprecated
    if (code) {
      try {
        evalCode(`${code}\n`);
      } catch (err) {
        _console.error(err);
        // Note: should not be killing the process here, but this codepath is deprecated anyway
        process.exit(1);
      }
    }

    // In case the typescript compiler hasn't compiled anything yet,
    // make it run though compilation at least one time before
    // the REPL starts for a snappier user experience on startup.
    service?.compile('', state.path);

    const repl = getNodeRepl().start({
      prompt: '> ',
      input: replService.stdin,
      output: replService.stdout,
      // Mimicking node's REPL implementation: https://github.com/nodejs/node/blob/168b22ba073ee1cbf8d0bcb4ded7ff3099335d04/lib/internal/repl.js#L28-L30
      terminal: (stdout as tty.WriteStream).isTTY && !parseInt(env.NODE_NO_READLINE!, 10),
      eval: nodeEval,
      useGlobal: true,
      ...optionsOverride,
    });

    nodeReplServer = repl;
    context = repl.context;

    // Bookmark the point where we should reset the REPL state.
    const resetEval = appendToEvalState(state, '');
    function reset() {
      resetEval();

      declareExports();

      if (forceToBeModule) {
        state.input += 'export {};void 0;\n';
      }

      // Declare node builtins.
      // Skip the same builtins as `addBuiltinLibsToObject`:
      //   those starting with _
      //   those containing /
      //   those that already exist as globals
      // Intentionally suppress type errors in case @types/node does not declare any of them, and because
      // `declare import` is technically invalid syntax.
      // Avoid this when in transpileOnly, because third-party transpilers may not handle `declare import`.
      if (!service?.transpileOnly) {
        state.input += `// @ts-ignore\n${builtinModules
          .filter(
            (name) => !name.startsWith('_') && !name.includes('/') && !['console', 'module', 'process'].includes(name)
          )
          .map((name) => `declare import ${name} = require('${name}')`)
          .join(';')}\n`;
      }
    }

    reset();
    repl.on('reset', reset);

    repl.defineCommand('type', {
      help: 'Check the type of a TypeScript identifier',
      action: function (identifier: string) {
        if (!identifier) {
          repl.displayPrompt();
          return;
        }

        const undo = appendToEvalState(state, identifier);
        const { name, comment } = service!.getTypeInfo(state.input, state.path, state.input.length);

        undo();

        if (name) repl.outputStream.write(`${name}\n`);
        if (comment) repl.outputStream.write(`${comment}\n`);
        repl.displayPrompt();
      },
    });

    // Set up REPL history when available natively via node.js >= 11.
    if (repl.setupHistory) {
      const historyPath = env.TS_NODE_HISTORY || join(homedir(), '.ts_node_repl_history');

      repl.setupHistory(historyPath, (err) => {
        if (!err) return;

        _console.error(err);
        process.exit(1);
      });
    }

    return repl;
  }
}

/**
 * Eval state management. Stores virtual `[eval].ts` file
 */
export class EvalState {
  /** @internal */
  input = '';
  /** @internal */
  output = '';
  /** @internal */
  version = 0;
  /** @internal */
  lines = 0;

  __tsNodeEvalStateBrand: unknown;

  constructor(public path: string) {}
}

/**
 * Filesystem host functions which are aware of the "virtual" `[eval].ts`, `<repl>`, or `[stdin].ts` file used to compile REPL inputs.
 * Must be passed to `create()` to create a ts-node compiler service which can compile REPL inputs.
 */
export type EvalAwarePartialHost = Pick<CreateOptions, 'readFile' | 'fileExists'>;

export function createEvalAwarePartialHost(state: EvalState, composeWith?: EvalAwarePartialHost): EvalAwarePartialHost {
  function readFile(path: string) {
    if (path === state.path) return state.input;

    if (composeWith?.readFile) return composeWith.readFile(path);

    try {
      return readFileSync(path, 'utf8');
    } catch (err) {
      /* Ignore. */
    }
  }
  function fileExists(path: string) {
    if (path === state.path) return true;

    if (composeWith?.fileExists) return composeWith.fileExists(path);

    try {
      const stats = statSync(path);
      return stats.isFile() || stats.isFIFO();
    } catch (err) {
      return false;
    }
  }
  return { readFile, fileExists };
}

const sourcemapCommentRe = /\/\/# ?sourceMappingURL=\S+[\s\r\n]*$/;

type AppendCompileAndEvalInputResult =
  | { containsTopLevelAwait: true; valuePromise: Promise<any> }
  | { containsTopLevelAwait: false; value: any };
/**
 * Evaluate the code snippet.
 *
 * Append it to virtual .ts file, compile, handle compiler errors, compute a diff of the JS, and eval any code that
 * appears as "added" in the diff.
 */
function appendCompileAndEvalInput(options: {
  service: Service;
  state: EvalState;
  input: string;
  wrappedErr?: unknown;
  /** Enable top-level await but only if the TSNode service allows it. */
  enableTopLevelAwait?: boolean;
  context: Context | undefined;
  /**
   * Added so that `evalCode` can be guaranteed *not* to trigger the `isCompletion`
   * codepath.  However, the `isCompletion` logic is ancient and maybe should be removed entirely.
   * Nobody's looked at it in a long time.
   */
  overrideIsCompletion?: boolean;
}): AppendCompileAndEvalInputResult {
  const { service, state, wrappedErr, enableTopLevelAwait = false, context, overrideIsCompletion } = options;
  let { input } = options;

  // It's confusing for `{ a: 1 }` to be interpreted as a block statement
  // rather than an object literal. So, we first try to wrap it in
  // parentheses, so that it will be interpreted as an expression.
  // Based on https://github.com/nodejs/node/blob/c2e6822153bad023ab7ebd30a6117dcc049e475c/lib/repl.js#L413-L422
  let wrappedCmd = false;
  if (!wrappedErr && /^\s*{/.test(input) && !/;\s*$/.test(input)) {
    input = `(${input.trim()})\n`;
    wrappedCmd = true;
  }

  const lines = state.lines;
  const isCompletion = overrideIsCompletion ?? !/\n$/.test(input);
  const undo = appendToEvalState(state, input);
  let output: string;

  // Based on https://github.com/nodejs/node/blob/92573721c7cff104ccb82b6ed3e8aa69c4b27510/lib/repl.js#L457-L461
  function adjustUseStrict(code: string) {
    // "void 0" keeps the repl from returning "use strict" as the result
    // value for statements and declarations that don't return a value.
    return code.replace(/^"use strict";/, '"use strict"; void 0;');
  }

  try {
    output = service.compile(state.input, state.path, -lines);
  } catch (err) {
    undo();

    if (wrappedCmd) {
      if (err instanceof TSError && err.diagnosticCodes[0] === 2339) {
        // Ensure consistent and more sane behavior between { a: 1 }['b'] and ({ a: 1 }['b'])
        throw err;
      }
      // Unwrap and try again
      return appendCompileAndEvalInput({
        ...options,
        wrappedErr: err,
      });
    }

    if (wrappedErr) throw wrappedErr;
    throw err;
  }

  output = adjustUseStrict(output);

  // Note: REPL does not respect sourcemaps!
  // To properly do that, we'd need to prefix the code we eval -- which comes
  // from `diffLines` -- with newlines so that it's at the proper line numbers.
  // Then we'd need to ensure each bit of eval-ed code, if there are multiples,
  // has the sourcemap appended to it.
  // We might also need to integrate with our sourcemap hooks' cache; I'm not sure.
  const outputWithoutSourcemapComment = output.replace(sourcemapCommentRe, '');
  const oldOutputWithoutSourcemapComment = state.output.replace(sourcemapCommentRe, '');

  // Use `diff` to check for new JavaScript to execute.
  const changes = getDiffLines()(oldOutputWithoutSourcemapComment, outputWithoutSourcemapComment);

  if (isCompletion) {
    undo();
  } else {
    state.output = output;

    // Insert a semicolon to make sure that the code doesn't interact with the next line,
    // for example to prevent `2\n+ 2` from producing 4.
    // This is safe since the output will not change since we can only get here with successful inputs,
    // and adding a semicolon to the end of a successful input won't ever change the output.
    state.input = state.input.replace(/([^\n\s])([\n\s]*)$/, (all, lastChar, whitespace) => {
      if (lastChar !== ';') return `${lastChar};${whitespace}`;
      return all;
    });
  }

  let commands: Array<{ mustAwait?: true; execCommand: () => any }> = [];
  let containsTopLevelAwait = false;

  // Build a list of "commands": bits of JS code in the diff that must be executed.
  for (const change of changes) {
    if (change.added) {
      if (enableTopLevelAwait && service.shouldReplAwait && change.value.indexOf('await') > -1) {
        const processTopLevelAwait = getProcessTopLevelAwait();

        // Newline prevents comments to mess with wrapper
        const wrappedResult = processTopLevelAwait(change.value + '\n');
        if (wrappedResult !== null) {
          containsTopLevelAwait = true;
          commands.push({
            mustAwait: true,
            execCommand: () => runInContext(wrappedResult, state.path, context),
          });
          continue;
        }
      }
      commands.push({
        execCommand: () => runInContext(change.value, state.path, context),
      });
    }
  }

  // Execute all commands asynchronously if necessary, returning the result or a
  // promise of the result.
  if (containsTopLevelAwait) {
    return {
      containsTopLevelAwait,
      valuePromise: (async () => {
        let value;
        for (const command of commands) {
          const r = command.execCommand();
          value = command.mustAwait ? await r : r;
        }
        return value;
      })(),
    };
  } else {
    return {
      containsTopLevelAwait: false,
      value: commands.reduce<any>((_, c) => c.execCommand(), undefined),
    };
  }
}

/**
 * Low-level execution of JS code in context
 */
function runInContext(code: string, filename: string, context?: Context) {
  const script = new Script(code, { filename });

  if (context === undefined || context === global) {
    return script.runInThisContext();
  } else {
    return script.runInContext(context);
  }
}

/**
 * Append to the eval instance and return an undo function.
 */
function appendToEvalState(state: EvalState, input: string) {
  const undoInput = state.input;
  const undoVersion = state.version;
  const undoOutput = state.output;
  const undoLines = state.lines;

  state.input += input;
  state.lines += lineCount(input);
  state.version++;

  return function () {
    state.input = undoInput;
    state.output = undoOutput;
    state.version = undoVersion;
    state.lines = undoLines;
  };
}

/**
 * Count the number of lines.
 */
function lineCount(value: string) {
  let count = 0;

  for (const char of value) {
    if (char === '\n') {
      count++;
    }
  }

  return count;
}

/**
 * TS diagnostic codes which are recoverable, meaning that the user likely entered an incomplete line of code
 * and should be prompted for the next.  For example, starting a multi-line for() loop and not finishing it.
 * null value means code is always recoverable.  `Set` means code is only recoverable when occurring alongside at least one
 * of the other codes.
 */
const RECOVERY_CODES: Map<number, Set<number> | null> = new Map([
  [1003, null], // "Identifier expected."
  [1005, null], // "')' expected.", "'}' expected."
  [1109, null], // "Expression expected."
  [1126, null], // "Unexpected end of text."
  [
    1136, // "Property assignment expected."
    new Set([1005]), // happens when typing out an object literal or block scope across multiple lines: '{ foo: 123,'
  ],
  [1160, null], // "Unterminated template literal."
  [1161, null], // "Unterminated regular expression literal."
  [2355, null], // "A function whose declared type is neither 'void' nor 'any' must return a value."
  [2391, null], // "Function implementation is missing or not immediately following the declaration."
  [
    7010, // "Function, which lacks return-type annotation, implicitly has an 'any' return type."
    new Set([1005]), // happens when fn signature spread across multiple lines: 'function a(\nb: any\n) {'
  ],
]);

/**
 * Diagnostic codes raised when using top-level await.
 * These are suppressed when top-level await is enabled.
 * When it is *not* enabled, these trigger a helpful hint about enabling top-level await.
 */
const topLevelAwaitDiagnosticCodes = [
  1375, // 'await' expressions are only allowed at the top level of a file when that file is a module, but this file has no imports or exports. Consider adding an empty 'export {}' to make this file a module.
  1378, // Top-level 'await' expressions are only allowed when the 'module' option is set to 'esnext' or 'system', and the 'target' option is set to 'es2017' or higher.
  1431, // 'for await' loops are only allowed at the top level of a file when that file is a module, but this file has no imports or exports. Consider adding an empty 'export {}' to make this file a module.
  1432, // Top-level 'for await' loops are only allowed when the 'module' option is set to 'esnext' or 'system', and the 'target' option is set to 'es2017' or higher.
];

/**
 * Check if a function can recover gracefully.
 */
function isRecoverable(error: TSError) {
  return error.diagnosticCodes.every((code) => {
    const deps = RECOVERY_CODES.get(code);
    return deps === null || (deps && error.diagnosticCodes.some((code) => deps.has(code)));
  });
}

/**
 * @internal
 * Set properties on `context` before eval-ing [stdin] or [eval] input.
 */
export function setupContext(context: any, module: Module, filenameAndDirname: 'eval' | 'stdin' | null) {
  if (filenameAndDirname) {
    context.__dirname = '.';
    context.__filename = `[${filenameAndDirname}]`;
  }
  context.module = module;
  context.exports = module.exports;
  context.require = module.require.bind(module);
}
