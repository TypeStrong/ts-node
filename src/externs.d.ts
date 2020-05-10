declare module 'pify' {
  const _export: typeof import('util').promisify
  export = _export
}
