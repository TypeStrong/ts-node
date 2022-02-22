import { BootstrapState, bootstrap } from '../bin';

const environmentVariableName = process.argv[2];
const base64Payload = process.env[environmentVariableName]!;
delete process.env[environmentVariableName];
const payload = JSON.parse(
  Buffer.from(base64Payload, 'base64').toString()
) as BootstrapState;
console.dir({
  payloadSize: base64Payload.length,
  payload: JSON.stringify(payload),
});
payload.isInChildProcess = true;

bootstrap(payload);
