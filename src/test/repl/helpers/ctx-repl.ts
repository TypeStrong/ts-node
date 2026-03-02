import type { ExecutionContext } from '@cspotcode/ava-lib';
import { expectStream } from '@cspotcode/expect-stream';
import { PassThrough } from 'stream';
import type { ctxTsNode } from '../../helpers/ctx-ts-node';
import { delay, tsNodeTypes } from '../../helpers/misc';
import { TEST_DIR } from '../../helpers/paths';

export interface CreateReplViaApiOptions {
  registerHooks: boolean;
  createReplOpts?: Partial<tsNodeTypes.CreateReplOptions>;
  createServiceOpts?: Partial<tsNodeTypes.CreateOptions>;
}

export interface ExecuteInReplOptions extends CreateReplViaApiOptions {
  waitMs?: number;
  waitPattern?: string | RegExp;
  /** When specified, calls `startInternal` instead of `start` and passes options */
  startInternalOptions?: Parameters<tsNodeTypes.ReplService['startInternal']>[0];
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

  function createReplViaApi({ registerHooks, createReplOpts, createServiceOpts }: CreateReplViaApiOptions) {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const replService = tsNodeUnderTest.createRepl({
      stdin,
      stdout,
      stderr,
      ...createReplOpts,
    });
    const service = (registerHooks ? tsNodeUnderTest.register : tsNodeUnderTest.create)({
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
    const stdoutPromise = expectStream(stdout);
    const stderrPromise = expectStream(stderr);
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
