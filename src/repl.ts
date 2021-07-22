import { diffLines } from 'diff';
import { homedir } from 'os';
import { dirname, join } from 'path';
import { Recoverable, start } from 'repl';
import { Script } from 'vm';
import { Service, CreateOptions, TSError, env } from './index';
import { readFileSync, statSync } from 'fs';
import { Console } from 'console';
import type * as tty from 'tty';
import Module = require('module');
import { ScriptElementKind } from 'typescript';

/** @internal */
export const EVAL_FILENAME = `[eval].ts`;
/** @internal */
export const EVAL_NAME = `[eval]`;
/** @internal */
export const STDIN_FILENAME = `[stdin].ts`;
/** @internal */
export const STDIN_NAME = `[stdin]`;
/** @internal */
export const REPL_FILENAME = '<repl>.ts';
/** @internal */
export const REPL_NAME = '<repl>';

export interface ReplService {
  readonly state: EvalState;
  /**
   * Bind this REPL to a ts-node compiler service.  A compiler service must be bound before `eval`-ing code or starting the REPL
   */
  setService(service: Service): void;
  evalCode(code: string): void;
  /**
   * `eval` implementation compatible with node's REPL API
   */
  nodeEval(
    code: string,
    _context: any,
    _filename: string,
    callback: (err: Error | null, result?: any) => any
  ): void;
  evalAwarePartialHost: EvalAwarePartialHost;
  /** Start a node REPL */
  start(code?: string): void;
  /** @internal */
  readonly stdin: NodeJS.ReadableStream;
  /** @internal */
  readonly stdout: NodeJS.WritableStream;
  /** @internal */
  readonly stderr: NodeJS.WritableStream;
  /** @internal */
  readonly console: Console;
}

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

/**
 * Create a ts-node REPL instance.
 *
 * Usage example:
 *
 *     const repl = tsNode.createRepl()
 *     const service = tsNode.create({...repl.evalAwarePartialHost})
 *     repl.setService(service)
 *     repl.start()
 */
export function createRepl(options: CreateReplOptions = {}) {
  let service = options.service;
  const state =
    options.state ?? new EvalState(join(process.cwd(), REPL_FILENAME));
  const evalAwarePartialHost = createEvalAwarePartialHost(
    state,
    options.composeWithEvalAwarePartialHost
  );
  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const _console =
    stdout === process.stdout && stderr === process.stderr
      ? console
      : new Console(stdout, stderr);
  const { ignoreDiagnosticsThatAreAnnoyingInInteractiveRepl = true } = options;

  const replService: ReplService = {
    state: options.state ?? new EvalState(join(process.cwd(), EVAL_FILENAME)),
    setService,
    evalCode,
    nodeEval,
    evalAwarePartialHost,
    start,
    stdin,
    stdout,
    stderr,
    console: _console,
  };
  return replService;

  function setService(_service: Service) {
    service = _service;
    if (ignoreDiagnosticsThatAreAnnoyingInInteractiveRepl) {
      service.addDiagnosticFilter({
        appliesToAllFiles: false,
        filenamesAbsolute: [state.path],
        diagnosticsIgnored: [
          2393, // Duplicate function implementation: https://github.com/TypeStrong/ts-node/issues/729
          6133, // <identifier> is declared but its value is never read. https://github.com/TypeStrong/ts-node/issues/850
          7027, // Unreachable code detected. https://github.com/TypeStrong/ts-node/issues/469
        ],
      });
    }
  }

  function evalCode(code: string) {
    return _eval(service!, state, code);
  }

  function nodeEval(
    code: string,
    _context: any,
    _filename: string,
    callback: (err: Error | null, result?: any) => any
  ) {
    let err: Error | null = null;
    let result: any;

    // TODO: Figure out how to handle completion here.
    if (code === '.scope') {
      callback(err);
      return;
    }

    try {
      result = evalCode(code);
    } catch (error) {
      if (error instanceof TSError) {
        // Support recoverable compilations using >= node 6.
        if (Recoverable && isRecoverable(error)) {
          err = new Recoverable(error);
        } else {
          _console.error(error);
        }
      } else {
        err = error;
      }
    }

    return callback(err, result);
  }

  function start(code?: string) {
    // TODO assert that service is set; remove all ! postfixes
    return startRepl(replService, service!, state, code);
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
 * Filesystem host functions which are aware of the "virtual" [eval].ts file used to compile REPL inputs.
 * Must be passed to `create()` to create a ts-node compiler service which can compile REPL inputs.
 */
export type EvalAwarePartialHost = Pick<
  CreateOptions,
  'readFile' | 'fileExists'
>;

export function createEvalAwarePartialHost(
  state: EvalState,
  composeWith?: EvalAwarePartialHost
): EvalAwarePartialHost {
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

/**
 * Evaluate the code snippet.
 */
function _eval(service: Service, state: EvalState, input: string) {
  const lines = state.lines;
  const isCompletion = !/\n$/.test(input);
  const undo = appendEval(state, input);
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
    throw err;
  }

  output = adjustUseStrict(output);

  // Use `diff` to check for new JavaScript to execute.
  const changes = diffLines(state.output, output);

  if (isCompletion) {
    undo();
  } else {
    state.output = output;
  }

  return changes.reduce((result, change) => {
    return change.added ? exec(change.value, state.path) : result;
  }, undefined);
}

/**
 * Execute some code.
 */
function exec(code: string, filename: string) {
  const script = new Script(code, { filename });

  return script.runInThisContext();
}

/**
 * Start a CLI REPL.
 */
function startRepl(
  replService: ReplService,
  service: Service,
  state: EvalState,
  code?: string
) {
  // Eval incoming code before the REPL starts.
  if (code) {
    try {
      replService.evalCode(`${code}\n`);
    } catch (err) {
      replService.console.error(err);
      process.exit(1);
    }
  }

  const repl = start({
    prompt: '> ',
    input: replService.stdin,
    output: replService.stdout,
    // Mimicking node's REPL implementation: https://github.com/nodejs/node/blob/168b22ba073ee1cbf8d0bcb4ded7ff3099335d04/lib/internal/repl.js#L28-L30
    terminal:
      (replService.stdout as tty.WriteStream).isTTY &&
      !parseInt(env.NODE_NO_READLINE!, 10),
    eval: replService.nodeEval,
    useGlobal: true,
  });

  // Bookmark the point where we should reset the REPL state.
  const resetEval = appendEval(state, '');

  function reset() {
    resetEval();

    // Hard fix for TypeScript forcing `Object.defineProperty(exports, ...)`.
    exec('exports = module.exports', state.path);
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

      const undo = appendEval(state, identifier);
      let { name, comment, kind } = service.getTypeInfo(
        state.input,
        state.path,
        state.input.length
      );

      undo();

      // Check if the user intended to query a Type/Interface
      if (kind === '') {
        // Workaround to get type information
        const undo = appendEval(state, `undefined as unknown as ${identifier}`);
        const getTypeInfoRes = service.getTypeInfo(
          state.input,
          state.path,
          state.input.length
        );

        undo();

        if (
          [
            ScriptElementKind.typeElement,
            ScriptElementKind.interfaceElement,
          ].includes(getTypeInfoRes.kind!)
        ) {
          name = getTypeInfoRes.name;
          comment = getTypeInfoRes.comment;
        }
      }

      if (name) repl.outputStream.write(`${name}\n`);
      if (comment) repl.outputStream.write(`${comment}\n`);
      repl.displayPrompt();
    },
  });

  // Set up REPL history when available natively via node.js >= 11.
  if (repl.setupHistory) {
    const historyPath =
      env.TS_NODE_HISTORY || join(homedir(), '.ts_node_repl_history');

    repl.setupHistory(historyPath, (err) => {
      if (!err) return;

      replService.console.error(err);
      process.exit(1);
    });
  }
}

/**
 * Append to the eval instance and return an undo function.
 */
function appendEval(state: EvalState, input: string) {
  const undoInput = state.input;
  const undoVersion = state.version;
  const undoOutput = state.output;
  const undoLines = state.lines;

  // Handle ASI issues with TypeScript re-evaluation.
  if (
    undoInput.charAt(undoInput.length - 1) === '\n' &&
    /^\s*[\/\[(`-]/.test(input) &&
    !/;\s*$/.test(undoInput)
  ) {
    state.input = `${state.input.slice(0, -1)};\n`;
  }

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

const RECOVERY_CODES: Set<number> = new Set([
  1003, // "Identifier expected."
  1005, // "')' expected."
  1109, // "Expression expected."
  1126, // "Unexpected end of text."
  1160, // "Unterminated template literal."
  1161, // "Unterminated regular expression literal."
  2355, // "A function whose declared type is neither 'void' nor 'any' must return a value."
]);

/**
 * Check if a function can recover gracefully.
 */
function isRecoverable(error: TSError) {
  return error.diagnosticCodes.every((code) => RECOVERY_CODES.has(code));
}

/** @internal */
export function setContext(
  context: any,
  module: Module,
  filenameAndDirname: 'eval' | 'stdin' | null
) {
  if (filenameAndDirname) {
    context.__dirname = '.';
    context.__filename = `[${filenameAndDirname}]`;
  }
  context.module = module;
  context.exports = module.exports;
  context.require = module.require.bind(module);
}

/** @internal */
export function createNodeModuleForContext(
  type: 'eval' | 'stdin',
  cwd: string
) {
  // Create a local module instance based on `cwd`.
  const module = new Module(`[${type}]`);
  module.filename = join(cwd, module.id) + '.ts';
  module.paths = (Module as any)._nodeModulePaths(cwd);
  return module;
}
