import * as promisify from 'util.promisify';
import { PassThrough } from 'stream';
import { getStream, TEST_DIR, tsNodeTypes } from '../helpers';
import type { ExecutionContext } from 'ava';
import { test, expect, TestInterface } from '../testlib';

export interface ContextWithTsNodeUnderTest {
  tsNodeUnderTest: Pick<
    typeof tsNodeTypes,
    'create' | 'register' | 'createRepl'
  >;
}

export type ContextWithReplHelpers = ContextWithTsNodeUnderTest &
  Awaited<ReturnType<typeof contextReplHelpers>>;
export type ReplExecutionContext = ExecutionContext<ContextWithReplHelpers>;

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

/**
 * pass to test.context() to get REPL testing helper functions
 */
export async function contextReplHelpers(
  t: ExecutionContext<ContextWithTsNodeUnderTest>
) {
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
    const stdoutPromise = getStream(stdout, waitPattern);
    const stderrPromise = getStream(stderr, waitPattern);
    // Wait for expected output pattern or timeout, whichever comes first
    await Promise.race([
      promisify(setTimeout)(waitMs),
      stdoutPromise,
      stderrPromise,
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

export function replMacros<T extends ContextWithReplHelpers>(
  _test: TestInterface<T>
) {
  return { noErrorsAndStdoutContains, stderrContains };

  function noErrorsAndStdoutContains(
    title: string,
    script: string,
    contains: string,
    options?: Partial<ExecuteInReplOptions>
  ) {
    testReplInternal(title, script, contains, undefined, contains, options);
  }
  function stderrContains(
    title: string,
    script: string,
    errorContains: string,
    options?: Partial<ExecuteInReplOptions>
  ) {
    testReplInternal(
      title,
      script,
      undefined,
      errorContains,
      errorContains,
      options
    );
  }
  function testReplInternal(
    title: string,
    script: string,
    stdoutContains: string | undefined,
    stderrContains: string | undefined,
    waitPattern: string,
    options?: Partial<ExecuteInReplOptions>
  ) {
    _test(title, async (t) => {
      const { stdout, stderr } = await t.context.executeInRepl(script, {
        registerHooks: true,
        startInternalOptions: { useGlobal: false },
        waitPattern,
        ...options,
      });
      if (stderrContains) expect(stderr).toContain(stderrContains);
      else expect(stderr).toBe('');
      if (stdoutContains) expect(stdout).toContain(stdoutContains);
    });
  }
}

const noErrorsAndStdoutContains = test.macro(
  (script: string, contains: string, options?: Partial<ExecuteInReplOptions>) =>
    async (t: ExecutionContext<ContextWithReplHelpers>) => {
      testReplInternal(t, script, contains, undefined, contains, options);
    }
);
const stderrContains = test.macro(
  (
      script: string,
      errorContains: string,
      options?: Partial<ExecuteInReplOptions>
    ) =>
    async (t: ReplExecutionContext) => {
      testReplInternal(
        t,
        script,
        undefined,
        errorContains,
        errorContains,
        options
      );
    }
);

async function testReplInternal(
  t: ExecutionContext<ContextWithReplHelpers>,
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
export const replMacros_ = { noErrorsAndStdoutContains, stderrContains };
