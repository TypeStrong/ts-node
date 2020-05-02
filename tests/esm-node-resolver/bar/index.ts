export const bar = 'bar' as const

if(typeof module !== 'undefined') throw new Error('module should not exist in ESM')
