import { brotliCompressSync, brotliDecompressSync, constants } from 'zlib';
import { pathToFileURL } from 'url';
import type { BootstrapState } from '../bin';

/** @internal */
export const argPrefix = '--brotli-base64-config=';

/** @internal */
export function compress(object: any) {
  return brotliCompressSync(Buffer.from(JSON.stringify(object), 'utf8'), {
    [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MIN_QUALITY,
  }).toString('base64');
}

/** @internal */
export function decompress(str: string) {
  return JSON.parse(
    brotliDecompressSync(Buffer.from(str, 'base64')).toString()
  );
}

/** @internal */
export function getChildProcessArguments(
  enableEsmLoader: boolean,
  state: BootstrapState
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

  // TODO avoid re-computing this in every child process; can re-use value from `execArgv`
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
