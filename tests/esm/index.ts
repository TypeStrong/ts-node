import {foo} from './foo.js'
import {bar} from './bar.js'
import {baz} from './baz.js'
import {biff} from './biff.js'

if(typeof module !== 'undefined') throw new Error('module should not exist in ESM')

console.log(`${foo} ${bar} ${baz} ${biff}`)
