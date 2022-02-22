import type { BootstrapState } from '../bin';
import { spawn } from 'child_process';
import * as fs from 'fs';

const passFirstXFds = 100;
const stdio: number[] = [];
for (let i = 0; i < passFirstXFds; i++) {
  stdio[i] = i;
}

/** @internal */
export function callInChild(state: BootstrapState) {
  let envVarName: string = 'TS_NODE_BOOTSTRAP';
  for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
    envVarName = `TS_NODE_BOOTSTRAP_${i}`;
    if (process.env[envVarName] === undefined) break;
  }
  const child = spawn(
    process.execPath,
    [
      '--require',
      require.resolve('./child-require.js'),
      '--loader',
      require.resolve('../../child-loader.mjs'),
      require.resolve('./child-entrypoint.js'),
      envVarName,
    ],
    {
      env: {
        ...process.env,
        [envVarName!]: Buffer.from(JSON.stringify(state), 'utf8').toString(
          'base64'
        ),
      },
      stdio,
      argv0: process.argv0,
    }
  );
  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
  child.on('exit', (code) => {
    child.removeAllListeners();
    process.off('SIGINT', onSigInt);
    process.off('SIGTERM', onSigTerm);
    process.exitCode = code === null ? 1 : code;
  });
  // Ignore sigint and sigterm in parent; pass them to child
  process.on('SIGINT', onSigInt);
  function onSigInt() {
    process.kill(child.pid, 'SIGINT');
  }
  process.on('SIGTERM', onSigTerm);
  function onSigTerm() {
    process.kill(child.pid, 'SIGTERM');
  }
  // Close all (well, a lot of) FDs in parent to avoid keeping them open.
  for (let fd = 0; fd < 100; fd++) {
    fs.close(fd, () => {});
  }
}
