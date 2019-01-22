import { join } from 'path'
import { fork } from 'child_process'

fork(join(__dirname, 'hello-world.ts'))
