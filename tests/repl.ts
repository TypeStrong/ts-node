import { start } from 'repl'
import { createReplEval, register } from '../src/index'

const service = register()
start({
  prompt: '> ',
  input: process.stdin,
  output: process.stdout,
  terminal: process.stdout.isTTY && !parseInt(process.env.NODE_NO_READLINE!, 10),
  eval: createReplEval(service),
  useGlobal: true
})

process.emit('SIGTERM', 'SIGTERM')
