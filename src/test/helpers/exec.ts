import type { ChildProcess, ExecException, ExecOptions, SpawnOptions } from 'child_process';
import { exec as childProcessExec, spawn as childProcessSpawn } from 'child_process';
import { ExpectStream, expectStream } from '@cspotcode/expect-stream';
import { expect } from '../testlib';

export type ExecReturn = Promise<ExecResult> & { child: ChildProcess };
export interface ExecResult {
  stdout: string;
  stderr: string;
  err: null | ExecException;
  child: ChildProcess;
}

export function createExec<T extends Partial<ExecOptions>>(preBoundOptions?: T) {
  /**
   * Helper to exec a child process.
   * Returns a Promise and a reference to the child process to suite multiple situations.
   * Promise resolves with the process's stdout, stderr, and error.
   */
  return function exec(
    cmd: string,
    opts?: Pick<ExecOptions, Exclude<keyof ExecOptions, keyof T>> &
      Partial<Pick<ExecOptions, keyof T & keyof ExecOptions>>
  ): ExecReturn {
    let child!: ChildProcess;
    return Object.assign(
      new Promise<ExecResult>((resolve, reject) => {
        child = childProcessExec(
          cmd,
          {
            ...preBoundOptions,
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
  };
}

export type SpawnReturn = Promise<SpawnResult> & SpawnResult;
export interface SpawnResult {
  stdout: ExpectStream;
  stderr: ExpectStream;
  code: number | null;
  child: ChildProcess;
}

export function createSpawn<T extends Partial<SpawnOptions>>(preBoundOptions?: T) {
  /**
   * Helper to spawn a child process.
   * Returns a Promise and a reference to the child process to suite multiple situations.
   *
   * Should almost always avoid this helper, and instead use `createExec` / `exec`.  `spawn`
   * may be necessary if you need to avoid `exec`'s intermediate shell.
   */
  return function spawn(
    cmd: string[],
    opts?: Pick<SpawnOptions, Exclude<keyof SpawnOptions, keyof T>> &
      Partial<Pick<SpawnOptions, keyof T & keyof SpawnOptions>>
  ): SpawnReturn {
    let child!: ChildProcess;
    let stdout!: ExpectStream;
    let stderr!: ExpectStream;
    const promise = Object.assign(
      new Promise<SpawnResult>((resolve, reject) => {
        child = childProcessSpawn(cmd[0], cmd.slice(1), {
          ...preBoundOptions,
          ...opts,
        });
        stdout = expectStream(child.stdout!);
        stderr = expectStream(child.stderr!);
        child.on('exit', (code) => {
          promise.code = code;
          resolve({ stdout, stderr, code, child });
        });
        child.on('error', (error) => {
          reject(error);
        });
      }),
      {
        child,
        stdout,
        stderr,
        code: null as number | null,
      }
    );
    return promise;
  };
}

const defaultExec = createExec();
export { defaultExec as exec };

export interface ExecTesterOptions {
  cmd: string;
  flags?: string;
  env?: Record<string, string>;
  stdin?: string;
  expectError?: boolean;
  exec?: typeof defaultExec;
}

/**
 * Create a function that launches a CLI command, optionally pipes stdin, optionally sets env vars,
 * optionally runs a couple baked-in assertions, and returns the results for additional assertions.
 */
export function createExecTester<T extends Partial<ExecTesterOptions>>(preBoundOptions: T) {
  return async function (
    options: Pick<ExecTesterOptions, Exclude<keyof ExecTesterOptions, keyof T>> &
      Partial<Pick<ExecTesterOptions, keyof T & keyof ExecTesterOptions>>
  ) {
    const {
      cmd,
      flags = '',
      stdin,
      expectError = false,
      env,
      exec = defaultExec,
    } = {
      ...preBoundOptions,
      ...options,
    };
    const p = exec(`${cmd} ${flags}`, {
      env: { ...process.env, ...env },
    });
    if (stdin !== undefined) {
      p.child.stdin!.end(stdin);
    }
    const r = await p;
    if (expectError) {
      expect(r.err).toBeDefined();
    } else {
      expect(r.err).toBeNull();
    }
    return r;
  };
}
