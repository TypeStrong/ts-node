#!/usr/bin/env node

import { extractArgv, filterNodeFlags } from './args'
import { execute } from './_bin'
import chalk from 'chalk'

function printErrorAndExit (error: Error) {
  let text = chalk.red.bold('⨯ ')
  text += chalk.bold(`Uncaught exception: ${error.message}\n`)

  const stack = error.stack ? error.stack.split('\n') : []

  if (stack[0] === error.message) {
    stack.shift()
  }

  for (const line of stack) {
    text += chalk.gray(line) + '\n'
  }

  console.error(text)
  process.exit(1)
}

const argv = process.argv.slice(2)

filterNodeFlags(argv)
  .then(extractArgv)
  .then(execute)
  .catch(printErrorAndExit)
