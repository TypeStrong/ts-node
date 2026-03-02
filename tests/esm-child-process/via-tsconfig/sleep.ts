setTimeout(function () {
  console.log('Slept 30 seconds');
  process.exit(456);
}, 30e3);
process.on('SIGTERM', onSignal);
process.on('SIGINT', onSignal);
console.log('child registered signal handlers');
function onSignal(signal: string) {
  console.log(`child received signal: ${signal}`);
  setTimeout(() => {
    console.log(`child exiting`);
    process.exit(123);
  }, 1e3);
}
