declare module NodeJS {
  interface Process {
    execArgv: string[]
  }
}

declare module 'module' {
  class Module {
    static runMain (): void
    static wrap (code: string): string
    static _nodeModulePaths (path: string): string[]
    static _load (request: string, parent?: Module, isMain?: boolean): any
    static _resolveFilename (request: string, parent?: Module, isMain?: boolean): string
    static _extensions: { [ext: string]: (m: Module, fileName: string) => any }

    constructor (filename: string, parent?: Module)

    parent: Module
    filename: string
    paths: string[]
    exports: any
    loaded: boolean
    require (module: string): any
  }

  export = Module
}
