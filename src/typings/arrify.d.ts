declare module 'arrify' {
  function arrify <T> (arr: T | T[]): T[]

  export = arrify
}
