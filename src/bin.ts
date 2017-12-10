#!/usr/bin/env node

import { spawn } from 'child_process'
import { join } from 'path'
import v8flags = require('v8flags')

const argv = process.argv.slice(2)
const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGWINCH']

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

  const env: { [key: string]: string | undefined } = {}

  for (const key of Object.keys(process.env)) {
    const val = process.env[key]
    if (key.substring(0, 8) === 'TS_NODE_') {
      env[key.substring(3)] = val
    } else {
      env[key] = val
    }
  }

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
      env,
      stdio: 'inherit'
    }
  )

  // Ignore signals, and instead forward them to the child process.
  signals.forEach(signal => process.on(signal, () => proc.kill(signal)))

  // On spawned close, exit this process with the same code.
  proc.on('close', (code: number, signal: string) => {
    if (signal) {
      process.kill(process.pid, signal)
    } else {
      process.exit(code)
    }
  })

  // If this process exits, kill the child first.
  process.on('exit', () => proc.kill())
})
