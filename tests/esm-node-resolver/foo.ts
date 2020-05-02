export const foo = 'foo' as const

if(typeof module !== 'undefined') throw new Error('module should not exist in ESM')
