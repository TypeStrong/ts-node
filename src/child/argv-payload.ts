import { brotliCompressSync, brotliDecompressSync, constants } from 'zlib';

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
  return JSON.parse(brotliDecompressSync(Buffer.from(str, 'base64')).toString());
}
