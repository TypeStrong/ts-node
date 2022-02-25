import type { BootstrapState } from '../bin';
import { spawn } from 'child_process';
import { brotliCompressSync } from 'zlib';
import { pathToFileURL } from 'url';
import { versionGteLt } from '..';

const argPrefix = '--brotli-base64-config=';
const extraNodeFlags: string[] = [];
if (!versionGteLt(process.version, '12.17.0'))
  extraNodeFlags.push('--experimental-modules');

/** @internal */
export function callInChild(state: BootstrapState) {
  const child = spawn(
    process.execPath,
    [
      '--require',
      require.resolve('./child-require.js'),
      ...extraNodeFlags,
      '--loader',
      // Node on Windows doesn't like `c:\` absolute paths here; must be `file:///c:/`
      pathToFileURL(require.resolve('../../child-loader.mjs')).toString(),
      require.resolve('./child-entrypoint.js'),
      `${argPrefix}${brotliCompressSync(
        Buffer.from(JSON.stringify(state), 'utf8')
      ).toString('base64')}`,
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
