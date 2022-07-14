import { fork } from 'child_process';
import type { BootstrapStateInitialProcess } from '../bin';
import { getChildProcessArguments } from './child-exec-args';

/**
 * @internal
 * @param state Bootstrap state to be transferred into the child process.
 * @param enableEsmLoader Whether to enable the ESM loader or not. This option may
 *   be removed in the future when `--esm` is no longer a choice.
 * @param targetCwd Working directory to be preserved when transitioning to
 *   the child process.
 */
export function callInChildWithEsm(
  state: BootstrapStateInitialProcess,
  targetCwd: string
) {
  const { childScriptArgs, childScriptPath, nodeExecArgs } =
    getChildProcessArguments(/* enableEsmLoader */ true, state);

  childScriptArgs.push(...state.restArgs);

  const child = fork(childScriptPath, childScriptArgs, {
    stdio: 'inherit',
    execArgv: [...process.execArgv, ...nodeExecArgs],
    cwd: targetCwd,
  });
  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
  child.on('exit', (code) => {
    child.removeAllListeners();
    process.off('SIGINT', sendSignalToChild);
    process.off('SIGTERM', sendSignalToChild);
    process.exitCode = code === null ? 1 : code;
  });
  // Ignore sigint and sigterm in parent; pass them to child
  process.on('SIGINT', sendSignalToChild);
  process.on('SIGTERM', sendSignalToChild);
  function sendSignalToChild(signal: string) {
    process.kill(child.pid, signal);
  }
}
