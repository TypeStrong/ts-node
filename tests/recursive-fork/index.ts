import { fork } from 'child_process';

// Type syntax to prove its compiled, though the import above should also
// prove the same
const a = null as any;

console.log(JSON.stringify({ execArgv: process.execArgv, argv: process.argv }));
if (process.env.generation !== 'grandchild') {
  const nextGeneration = process.env.generation === 'child' ? 'grandchild' : 'child';
  fork(__filename, process.argv.slice(2), {
    env: { ...process.env, generation: nextGeneration },
    stdio: 'inherit',
  });
}
