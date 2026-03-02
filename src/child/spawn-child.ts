import type { BootstrapState } from '../bin';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import { argPrefix, compress } from './argv-payload';

/**
 * @internal
 * @param state Bootstrap state to be transferred into the child process.
 * @param targetCwd Working directory to be preserved when transitioning to
 *   the child process.
 */
export function callInChild(state: BootstrapState) {
  const child = spawn(
    process.execPath,
    [
      '--require',
      require.resolve('./child-require.js'),
      '--loader',
      // Node on Windows doesn't like `c:\` absolute paths here; must be `file:///c:/`
      pathToFileURL(require.resolve('../../child-loader.mjs')).toString(),
      require.resolve('./child-entrypoint.js'),
      `${argPrefix}${compress(state)}`,
      ...state.parseArgvResult.restArgs,
    ],
    {
      stdio: 'inherit',
      argv0: process.argv0,
    }
  );
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
