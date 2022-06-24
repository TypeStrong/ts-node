import { fork } from 'child_process';
import { fileURLToPath } from 'url';

// Type syntax to prove its compiled, though the import above should also
// prove the same
const a = null as any;
const currentScript = fileURLToPath(import.meta.url);

console.log(JSON.stringify({ execArgv: process.execArgv, argv: process.argv }));
if (process.env.generation !== 'grandchild') {
  const nextGeneration =
    process.env.generation === 'child' ? 'grandchild' : 'child';
  fork(currentScript, process.argv.slice(2), {
    env: { ...process.env, generation: nextGeneration },
    stdio: 'inherit',
  });
}
