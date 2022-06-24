import { pathToFileURL } from 'url';
import { brotliCompressSync } from 'zlib';
import type { BootstrapStateForChild } from '../bin';
import { argPrefix } from './argv-payload';

export function getChildProcessArguments(
  enableEsmLoader: boolean,
  state: BootstrapStateForChild
) {
  const nodeExecArgs = [];

  if (enableEsmLoader) {
    nodeExecArgs.push(
      '--require',
      require.resolve('./child-require.js'),
      '--loader',
      // Node on Windows doesn't like `c:\` absolute paths here; must be `file:///c:/`
      pathToFileURL(require.resolve('../../child-loader.mjs')).toString()
    );
  }

  const childScriptArgs = [
    `${argPrefix}${brotliCompressSync(
      Buffer.from(JSON.stringify(state), 'utf8')
    ).toString('base64')}`,
  ];

  return {
    nodeExecArgs,
    childScriptArgs,
    childScriptPath: require.resolve('./child-entrypoint.js'),
  };
}
