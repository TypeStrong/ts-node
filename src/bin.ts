#!/usr/bin/env node

import { spawn } from 'child_process'
import { join } from 'path'
import v8flags = require('v8flags')

const argv = process.argv.slice(2)

v8flags(function (err, v8flags) {
  if (err) {
    console.error(err.stack)
    process.exit(1)
    return
  }

  const nodeArgs: string[] = []
  const scriptArgs: string[] = []

  const knownFlags = v8flags.concat([
    'debug',
    'inspect',
    '--debug',
    '--debug-brk',
    '--inspect',
    '--inspect-brk',
    '--nolazy',
    '--no-deprecation',
    '--log-timer-events',
    '--throw-deprecation',
    '--trace-deprecation',
    '--allow-natives-syntax',
    '--perf-basic-prof',
    '--preserve-symlinks',
    '--expose-gc',
    '--expose-http2'
  ])

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const flag = arg.split('=', 1)[0]

    if (knownFlags.indexOf(flag) > -1) {
      nodeArgs.push(arg)
    } else if (/^-/.test(flag)) {
      scriptArgs.push(arg)
    } else {
      // Break when we encounter a "script".
      scriptArgs.push(...argv.slice(i))
      break
    }
  }

  const proc = spawn(
    process.execPath,
    nodeArgs.concat(join(__dirname, '_bin.js'), scriptArgs),
    {
      // We need to run in detached mode so to avoid
      // automatic propagation of signals to the child process.
      // This is necessary because by default, keyboard interrupts
      // are propagated to the process tree, but `kill` is not.
      //
      // See: https://nodejs.org/api/child_process.html#child_process_options_detached
      detached: true,

      // Pipe all input and output to this process
      stdio: 'inherit'
    }
  )

  // Ignore signals, and instead forward them to the
  // child process
  const forward = (signal: NodeJS.Signals) => process.on(signal, () => proc.kill(signal))

  // Interrupt (CTRL-C)
  forward('SIGINT')

  // Termination (`kill` default signal)
  forward('SIGTERM')

  // Terminal size change must be forwarded to the subprocess
  forward('SIGWINCH')

  // On exit, exit this process with the same exit code
  proc.on('close', (code: number, signal: string) => {
    if (signal) {
      process.kill(process.pid, signal)
    } else if (code) {
      process.exit(code)
    }
  })

  // If this process is exited, kill the child first
  process.on('exit', (_code: number) => proc.kill())
})
