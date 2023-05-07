import type { ctxRepl, ExecuteInReplOptions } from './ctx-repl';
import { expect, test } from '../../testlib';

export const macroReplNoErrorsAndStdoutContains = test.macro(
  (script: string, contains: string, options?: Partial<ExecuteInReplOptions>) => async (t: ctxRepl.T) => {
    macroReplInternal(t, script, contains, undefined, contains, options);
  }
);
export const macroReplStderrContains = test.macro(
  (script: string, errorContains: string, options?: Partial<ExecuteInReplOptions>) => async (t: ctxRepl.T) => {
    macroReplInternal(t, script, undefined, errorContains, errorContains, options);
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
  const r = await t.context.executeInRepl(script, {
    registerHooks: true,
    startInternalOptions: { useGlobal: false },
    waitPattern,
    ...options,
  });
  if (stderrContains) expect(r.stderr).toContain(stderrContains);
  else expect(r.stderr).toBe('');
  if (stdoutContains) expect(r.stdout).toContain(stdoutContains);
}
