import assert from 'assert';
assert(import.meta.url.includes('index.ts'));
console.log('Hello world!');
console.dir(process.argv);
if (process.argv[2] === 'sleep') {
  setTimeout(function () {
    console.log('Slept 30 seconds');
  }, 30e3);
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
}
function onSignal(signal: string) {
  console.log(`child received signal: ${signal}`);
  setTimeout(() => {
    process.exit(123);
  }, 5e3);
}
