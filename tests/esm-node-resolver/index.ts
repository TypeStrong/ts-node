import {foo} from './foo'
import {bar} from './bar'
import {baz} from './baz'
import {biff} from './biff'

if(typeof module !== 'undefined') throw new Error('module should not exist in ESM')

console.log(`${foo} ${bar} ${baz} ${biff}`)
