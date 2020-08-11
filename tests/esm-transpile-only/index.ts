import { foo } from './foo.js'
import { bar } from './bar.js'
import { baz } from './baz.js'
import { biff } from './biff.js'

if (typeof module !== 'undefined') throw new Error('module should not exist in ESM')

// intentional type errors to check transpile-only ESM loader skips type checking
parseInt(1101, 2)
const x: number = 'hello world'

console.log(`${foo} ${bar} ${baz} ${biff}`)
