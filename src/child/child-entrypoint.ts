import { completeBootstrap, BootstrapStateForChild } from '../bin';
import { argPrefix, decompress } from './argv-payload';

const base64ConfigArg = process.argv[2];
if (!base64ConfigArg.startsWith(argPrefix)) throw new Error('unexpected argv');
const base64Payload = base64ConfigArg.slice(argPrefix.length);
const state = decompress(base64Payload) as BootstrapStateForChild;

state.parseArgvResult.restArgs = process.argv.slice(3);

completeBootstrap(state);
