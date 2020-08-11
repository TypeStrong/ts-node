export const foo = 'foo'

if (typeof module !== 'undefined') throw new Error('module should not exist in ESM')
