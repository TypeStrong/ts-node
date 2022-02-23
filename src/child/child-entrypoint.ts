import { BootstrapState, bootstrap } from '../bin';

const base64ConfigArg = process.argv[2];
const argPrefix = '--base64-config=';
if (!base64ConfigArg.startsWith(argPrefix)) throw new Error('unexpected argv');
const base64Payload = base64ConfigArg.slice(argPrefix.length);
const payload = JSON.parse(
  Buffer.from(base64Payload, 'base64').toString()
) as BootstrapState;
payload.isInChildProcess = true;

bootstrap(payload);
