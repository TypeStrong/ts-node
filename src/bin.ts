#!/usr/bin/env node

import { spawn } from 'child_process'
import { join } from 'path'

const args = [join(__dirname, '_bin.js')]
const opts = process.argv.slice(2)

for (let i = 0; i < opts.length; i++) {
  const arg = opts[i]
  const flag = arg.split('=', 1)[0]

  switch (flag) {
    case '-d':
      args.unshift('--debug')
      opts.splice(i, 1)
      break
    case '-gc':
    case '--expose-gc':
      args.unshift('--expose-gc')
      opts.splice(i, 1)
      break
    case 'debug':
    case '--debug':
    case '--debug-brk':
    case '--inspect':
    case '--gc-global':
    case '--es_staging':
    case '--no-deprecation':
    case '--prof':
    case '--log-timer-events':
    case '--throw-deprecation':
    case '--trace-deprecation':
    case '--use_strict':
    case '--allow-natives-syntax':
    case '--perf-basic-prof':
      args.unshift(arg)
      opts.splice(i, 1)
      break
    default:
      if (/^--(?:harmony|trace|icu-data-dir|max-old-space-size)/.test(arg)) {
        args.unshift(arg)
        opts.splice(i, 1)
      }
      break
  }

  // Stop on first non-argument because it's the script name.
  if (/^[^-]/.test(arg)) {
    break
  }
}

const proc = spawn(process.execPath, args.concat(opts), { stdio: 'inherit' })

proc.on('exit', function (code: number, signal: string) {
  process.on('exit', function () {
    if (signal) {
      process.kill(process.pid, signal)
    } else {
      process.exit(code)
    }
  })
})
