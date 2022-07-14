import { BootstrapState, bootstrap } from '../bin';
import { argPrefix, compress, decompress } from './argv-payload';

const base64ConfigArg = process.argv[2];
if (!base64ConfigArg.startsWith(argPrefix)) throw new Error('unexpected argv');
const base64Payload = base64ConfigArg.slice(argPrefix.length);
const state = decompress(base64Payload) as BootstrapState;

state.isInChildProcess = true;
state.tsNodeScript = __filename;
state.parseArgvResult.argv = process.argv;
state.parseArgvResult.restArgs = process.argv.slice(3);

// Modify and re-compress the payload delivered to subsequent child processes.
// This logic may be refactored into bin.ts by https://github.com/TypeStrong/ts-node/issues/1831
if (state.isCli) {
  const stateForChildren: BootstrapState = {
    ...state,
    isCli: false,
  };
  state.parseArgvResult.argv[2] = `${argPrefix}${compress(stateForChildren)}`;
}

bootstrap(state);
