declare module 'util.promisify' {
  const _export: typeof import('util').promisify;
  export = _export;
}
