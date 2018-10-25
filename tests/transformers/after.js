const ts = require('typescript');

module.exports = {
  before: [(ctx) => {
    return sourceFile => {
      function visitor (node) {
        return ts.visitEachChild(node, visitor, ctx)
      }
      return ts.visitEachChild(sourceFile, visitor, ctx)
    }
  }],

  after: [(ctx) => {
    return sourceFile => {
      function visitor (node) {
        return ts.visitEachChild(node, visitor, ctx)
      }
      return ts.visitEachChild(sourceFile, visitor, ctx)
    }
  }],

  afterDeclarations: [(ctx) => {
    return sourceFile => {
      function visitor (node) {
        return ts.visitEachChild(node, visitor, ctx)
      }
      return ts.visitEachChild(sourceFile, visitor, ctx)
    }
  }]
}
