import type { ChildProcess, ExecException, ExecOptions } from 'child_process';
import { exec as childProcessExec } from 'child_process';
import type { TestInterface } from './testlib';
import { expect } from 'chai';
import * as exp from 'expect';

export type ExecReturn = Promise<ExecResult> & { child: ChildProcess };
export interface ExecResult {
  stdout: string;
  stderr: string;
  err: null | ExecException;
  child: ChildProcess;
}

export interface ExecMacroOptions {
  titlePrefix?: string;
  cmd: string;
  flags?: string;
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  expectError?: boolean;
}
export type ExecMacroAssertionCallback = (
  stdout: string,
  stderr: string,
  err: ExecException | null
) => Promise<void> | void;

export interface createMacrosAndHelpersOptions {
  test: TestInterface<unknown>;
  defaultCwd: string;
}
export function createMacrosAndHelpers(opts: createMacrosAndHelpersOptions) {
  const { test, defaultCwd } = opts;

  /**
   * Helper to exec a child process.
   * Returns a Promise and a reference to the child process to suite multiple situations.
   * Promise resolves with the process's stdout, stderr, and error.
   */
  function exec(cmd: string, opts: ExecOptions = {}): ExecReturn {
    let child!: ChildProcess;
    return Object.assign(
      new Promise<ExecResult>((resolve, reject) => {
        child = childProcessExec(
          cmd,
          {
            cwd: defaultCwd,
            ...opts,
          },
          (err, stdout, stderr) => {
            resolve({ err, stdout, stderr, child });
          }
        );
      }),
      {
        child,
      }
    );
  }

  /**
   * Create a macro that launches a CLI command, optionally pipes stdin, optionally sets env vars,
   * and allows assertions against the output.
   */
  function createExecMacro<T extends Partial<ExecMacroOptions>>(
    preBoundOptions: T
  ) {
    return test.macro(
      (
        options: Pick<
          ExecMacroOptions,
          Exclude<keyof ExecMacroOptions, keyof T>
        > &
          Partial<Pick<ExecMacroOptions, keyof T & keyof ExecMacroOptions>>,
        assertions: ExecMacroAssertionCallback
      ) => [
        (title) => `${options.titlePrefix ?? ''}${title}`,
        async (t) => {
          const { cmd, flags = '', stdin, expectError = false, cwd, env } = {
            ...preBoundOptions,
            ...options,
          };
          const execPromise = exec(`${cmd} ${flags}`, {
            cwd,
            env: { ...process.env, ...env },
          });
          if (stdin !== undefined) {
            execPromise.child.stdin!.end(stdin);
          }
          const { err, stdout, stderr } = await execPromise;
          if (expectError) {
            exp(err).toBeDefined();
          } else {
            exp(err).toBeNull();
          }
          await assertions(stdout, stderr, err);
        },
      ]
    );
  }

  return {
    exec,
    createExecMacro,
  };
}
