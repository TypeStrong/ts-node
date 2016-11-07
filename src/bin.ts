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
    '--debug',
    '--debug-brk',
    '--inspect',
    '--nolazy',
    '--no-deprecation',
    '--log-timer-events',
    '--throw-deprecation',
    '--trace-deprecation',
    '--allow-natives-syntax',
    '--perf-basic-prof'
  ])

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const flag = arg.split('=', 1)[0]

    if (flag === '-d') {
      nodeArgs.push('--debug')
    } else if (flag === '-gc') {
      nodeArgs.push('--expose-gc')
    } else if (knownFlags.indexOf(flag) > -1) {
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
    { stdio: 'inherit' }
  )

  proc.on('exit', function (code: number, signal: string) {
    process.on('exit', function () {
      if (signal) {
        process.kill(process.pid, signal)
      } else {
        process.exit(code)
      }
    })
  })
})
