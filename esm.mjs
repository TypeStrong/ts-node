import {fileURLToPath} from 'url'
import {createRequire} from 'module'
const require = createRequire(fileURLToPath(import.meta.url))

export const {resolve, getFormat, transformSource} = require('./dist/esm').registerAndCreateEsmHooks()
