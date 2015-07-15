declare module 'xtend/mutable' {
  function extend <T> (dest: T, ...src: Object[]): T

  export = extend
}

declare module 'xtend/immutable' {
  function extend <T> (dest: T, ...src: Object[]): T

  export = extend
}

declare module 'xtend' {
  import immutable = require('xtend/immutable')

  export = immutable
}
