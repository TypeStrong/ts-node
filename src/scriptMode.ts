#!/usr/bin/env node

// add script mode flag in not present
if (!(process.argv.includes('-s') || process.argv.includes('--script-mode'))) {
  process.argv.splice(2, 0, '-s')
}

import './bin'
