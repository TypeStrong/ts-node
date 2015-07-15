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

    constructor (filename: string)

    filename: string
    paths: string[]
    exports: any
    require (module: string): any
  }

  export = Module
}
