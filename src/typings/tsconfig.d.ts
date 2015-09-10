declare module 'tsconfig' {
  export function resolveSync (fileName: string): any
  export function readFileSync (fileName: string): any
}
