declare module 'xtend/mutable' {
  function extend <A, B, C> (a: A, b?: B, c?: C): A & B & C

  export = extend
}

declare module 'xtend/immutable' {
  function extend <A, B, C> (a: A, b?: B, c?: C): A & B & C

  export = extend
}

declare module 'xtend' {
  import immutable = require('xtend/immutable')

  export = immutable
}
