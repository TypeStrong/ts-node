#!/usr/bin/env node

import { main } from './bin'

main(['--transpile-only', ...process.argv.slice(2)])
