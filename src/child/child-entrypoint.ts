import { BootstrapState, bootstrap } from '../bin';
import { brotliDecompressSync } from 'zlib';

const base64ConfigArg = process.argv[2];
const argPrefix = '--brotli-base64-config=';
if (!base64ConfigArg.startsWith(argPrefix)) throw new Error('unexpected argv');
const base64Payload = base64ConfigArg.slice(argPrefix.length);
const payload = JSON.parse(
  brotliDecompressSync(Buffer.from(base64Payload, 'base64')).toString()
) as BootstrapState;
payload.isInChildProcess = true;
payload.entrypoint = __filename;
payload.parseArgvResult.argv = process.argv;
payload.parseArgvResult.restArgs = process.argv.slice(3);

bootstrap(payload);
