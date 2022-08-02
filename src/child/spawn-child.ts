import { fork } from 'child_process';
import type { Phase3Input, Phase4Input } from '../bin';
import { getChildProcessArguments } from './utils';

/**
 * @internal
 * @param state Bootstrap state to be transferred into the child process.
 */
export function callInChild(state: Phase3Input | Phase4Input) {
  const { childScriptArgs, childScriptPath, nodeExecArgs } =
    getChildProcessArguments(/* enableEsmLoader */ true, state);

  childScriptArgs.push(...state.restArgs);

  const child = fork(childScriptPath, childScriptArgs, {
    stdio: 'inherit',
    execArgv: [...process.execArgv, ...nodeExecArgs],
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
