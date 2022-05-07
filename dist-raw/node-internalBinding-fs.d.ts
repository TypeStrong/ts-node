// Copied from https://github.com/nodejs/node/blob/b66a75a3a4361614dde9bc1a52d7e9021b4efc26/typings/internalBinding/fs.d.ts
declare namespace InternalFSBinding {
  function internalModuleStat(path: string): number;
}
export const internalModuleStat: typeof InternalFSBinding.internalModuleStat;
