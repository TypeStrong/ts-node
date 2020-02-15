#!/usr/bin/env node

import { main } from './bin'

main(['--script-mode', ...process.argv.slice(2)])
