const ts = require('typescript');

module.exports = {
  before: [(ctx) => {
    return sourceFile => {
      sourceFile.statements.splice(
        3,
        0,
        // return let a = 1000,
        ts.createVariableStatement(
          undefined,
          ts.createVariableDeclarationList(
            [ ts.createVariableDeclaration(
              ts.createIdentifier('a'),
              undefined,
              ts.createIdentifier('1000'),
            ) ],
            ts.NodeFlags.Let
          )
        )
      )

      function visitor (node) {
        return ts.visitEachChild(node, visitor, ctx)
      }
      return ts.visitEachChild(sourceFile, visitor, ctx)
    }
  }]
}
