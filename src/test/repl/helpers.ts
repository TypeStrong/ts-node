import * as promisify from 'util.promisify';
import * as getStream from 'get-stream';
import { PassThrough } from 'stream';
import { TEST_DIR, tsNodeTypes } from '../helpers';
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
    {
      waitMs = 1e3,
      startOptions,
      ...rest
    }: CreateReplViaApiOptions & {
      waitMs?: number;
      startOptions?: Parameters<tsNodeTypes.ReplService['startInternal']>[0];
    }
  ) {
    const { stdin, stdout, stderr, replService } = createReplViaApi(rest);

    replService.startInternal(startOptions);

    stdin.write(input);
    stdin.end();
    await promisify(setTimeout)(waitMs);
    stdout.end();
    stderr.end();

    return {
      stdin,
      stdout: await getStream(stdout),
      stderr: await getStream(stderr),
    };
  }
}

export async function contextReplApiTester(
  t: ExecutionContext<ContextWithTsNodeUnderTest>
) {
  const { createReplViaApi } = await contextReplHelpers(t);
  return { replApiTester };

  async function replApiTester(opts: { input: string }) {
    const { input } = opts;
    const { stdin, stdout, stderr, replService } = createReplViaApi({
      registerHooks: true,
    });
    replService.start();
    stdin.write(input);
    stdin.end();
    await promisify(setTimeout)(1e3);
    stdout.end();
    stderr.end();
    const stderrString = await getStream(stderr);
    const stdoutString = await getStream(stdout);
    return { stdout: stdoutString, stderr: stderrString };
  }
}
