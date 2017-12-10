process.on('SIGINT', () => {
  process.stdout.write('exited')
  setTimeout(() => {
    process.stdout.write(' fine')

    // Needed to make sure what we wrote has time
    // to be written
    process.nextTick(() => process.exit())
  }, 500)
})

setInterval(() => console.log('should not be reached'), 3000)
