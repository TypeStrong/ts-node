const extensions = ['.tsx']

extensions.forEach(ext => {
  const old = require.extensions[ext]

  require.extensions[ext] = (m, path) => {
    const _compile = m._compile

    m._compile = (code, path) => {
      console.error(code)
      return _compile.call(this, code, path)
    }

    return old(m, path)
  }
})
