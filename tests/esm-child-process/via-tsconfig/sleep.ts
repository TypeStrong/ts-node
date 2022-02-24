setTimeout(function () {
  console.log('Slept 30 seconds');
}, 30e3);
process.on('SIGTERM', onSignal);
process.on('SIGINT', onSignal);
function onSignal(signal: string) {
  console.log(`child received signal: ${signal}`);
  setTimeout(() => {
    process.exit(123);
  }, 5e3);
}
