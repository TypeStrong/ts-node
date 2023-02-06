import { PassThrough } from 'stream';
import { delay, getStream, TEST_DIR, tsNodeTypes, ctxTsNode } from '../helpers';
import type { ExecutionContext } from 'ava';
import { test, expect } from '../testlib';

export interface CreateReplViaApiOptions {
  registerHooks: boolean;
  createReplOpts?: Partial<tsNodeTypes.CreateReplOptions>;
  createServiceOpts?: Partial<tsNodeTypes.CreateOptions>;
}

export interface ExecuteInReplOptions extends CreateReplViaApiOptions {
  waitMs?: number;
  waitPattern?: string | RegExp;
  /** When specified, calls `startInternal` instead of `start` and passes options */
  startInternalOptions?: Parameters<
    tsNodeTypes.ReplService['startInternal']
  >[0];
}

export namespace ctxRepl {
  export type Ctx = ctxTsNode.Ctx & Awaited<ReturnType<typeof ctxRepl>>;
  export type T = ExecutionContext<Ctx>;
}

/**
 * pass to test.context() to get REPL testing helper functions
 */
export async function ctxRepl(t: ctxTsNode.T) {
  const { tsNodeUnderTest } = t.context;
  return { createReplViaApi, executeInRepl };

  function createReplViaApi({
    registerHooks,
    createReplOpts,
    createServiceOpts,
  }: CreateReplViaApiOptions) {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const replService = tsNodeUnderTest.createRepl({
      stdin,
      stdout,
      stderr,
      ...createReplOpts,
    });
    const service = (
      registerHooks ? tsNodeUnderTest.register : tsNodeUnderTest.create
    )({
      ...replService.evalAwarePartialHost,
      project: `${TEST_DIR}/tsconfig.json`,
      ...createServiceOpts,
      tsTrace: replService.console.log.bind(replService.console),
    });
    replService.setService(service);
    t.teardown(async () => {
      service.enabled(false);
    });

    return { stdin, stdout, stderr, replService, service };
  }

  async function executeInRepl(input: string, options: ExecuteInReplOptions) {
    const {
      waitPattern,
      // Wait longer if there's a signal to end it early
      waitMs = waitPattern != null ? 20e3 : 1e3,
      startInternalOptions,
      ...rest
    } = options;
    const { stdin, stdout, stderr, replService } = createReplViaApi(rest);

    if (startInternalOptions) {
      replService.startInternal(startInternalOptions);
    } else {
      replService.start();
    }

    stdin.write(input);
    stdin.end();
    const stdoutPromise = getStream(stdout);
    const stderrPromise = getStream(stderr);
    // Wait for expected output pattern or timeout, whichever comes first
    await Promise.race([
      delay(waitMs),
      waitPattern != null ? stdoutPromise.wait(waitPattern) : stdoutPromise,
      waitPattern != null ? stderrPromise.wait(waitPattern) : stderrPromise,
    ]);
    stdout.end();
    stderr.end();

    return {
      stdin,
      stdout: await stdoutPromise,
      stderr: await stderrPromise,
    };
  }
}

export const macroReplNoErrorsAndStdoutContains = test.macro(
  (script: string, contains: string, options?: Partial<ExecuteInReplOptions>) =>
    async (t: ctxRepl.T) => {
      macroReplInternal(t, script, contains, undefined, contains, options);
    }
);
export const macroReplStderrContains = test.macro(
  (
      script: string,
      errorContains: string,
      options?: Partial<ExecuteInReplOptions>
    ) =>
    async (t: ctxRepl.T) => {
      macroReplInternal(
        t,
        script,
        undefined,
        errorContains,
        errorContains,
        options
      );
    }
);

async function macroReplInternal(
  t: ctxRepl.T,
  script: string,
  stdoutContains: string | undefined,
  stderrContains: string | undefined,
  waitPattern: string,
  options?: Partial<ExecuteInReplOptions>
) {
  const { stdout, stderr } = await t.context.executeInRepl(script, {
    registerHooks: true,
    startInternalOptions: { useGlobal: false },
    waitPattern,
    ...options,
  });
  if (stderrContains) expect(stderr).toContain(stderrContains);
  else expect(stderr).toBe('');
  if (stdoutContains) expect(stdout).toContain(stdoutContains);
}
