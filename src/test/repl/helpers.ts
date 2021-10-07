import * as promisify from 'util.promisify';
import { PassThrough } from 'stream';
import { getStream, TEST_DIR, tsNodeTypes } from '../helpers';
import type { ExecutionContext } from 'ava';

export interface ContextWithTsNodeUnderTest {
  tsNodeUnderTest: Pick<
    typeof tsNodeTypes,
    'create' | 'register' | 'createRepl'
  >;
}

export interface CreateReplViaApiOptions {
  registerHooks: true;
  createReplOpts?: Partial<tsNodeTypes.CreateReplOptions>;
  createServiceOpts?: Partial<tsNodeTypes.CreateOptions>;
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
    const service = (registerHooks
      ? tsNodeUnderTest.register
      : tsNodeUnderTest.create)({
      ...replService.evalAwarePartialHost,
      project: `${TEST_DIR}/tsconfig.json`,
      ...createServiceOpts,
      trace: replService.console.log.bind(replService.console)
    });
    replService.setService(service);
    t.teardown(async () => {
      service.enabled(false);
    });

    return { stdin, stdout, stderr, replService, service };
  }

  // Todo combine with replApiMacro
  async function executeInRepl(
    input: string,
    options: CreateReplViaApiOptions & {
      waitMs?: number;
      waitPattern?: string | RegExp;
      /** When specified, calls `startInternal` instead of `start` and passes options */
      startInternalOptions?: Parameters<
        tsNodeTypes.ReplService['startInternal']
      >[0];
    }
  ) {
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
