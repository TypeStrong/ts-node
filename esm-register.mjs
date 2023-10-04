import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

register(pathToFileURL('./esm.mjs'), pathToFileURL('./'))
