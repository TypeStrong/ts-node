declare module 'make-error' {
  export class BaseError implements Error {
    message: string
    name: string
    stack: string

    constructor (message: string)
  }
}
