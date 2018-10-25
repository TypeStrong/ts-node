const ts = require('typescript');

module.exports = {
  before: [(ctx) => {
    return sourceFile => {
      const interfaceNode = sourceFile.statements.find(node => ts.isInterfaceDeclaration(node));
      if (interfaceNode) {
        const jsonItem = [];

        interfaceNode.members.forEach(n => {
          const key = n.name.escapedText;
          const type = (n.type.kind === 134) ? 'number' : 'string';
          jsonItem.push(ts.createPropertyAssignment(key, ts.createLiteral(type)));
        });

        sourceFile.statements.splice(
          1,
          0,
          ts.createVariableStatement(
            undefined,
            ts.createVariableDeclarationList(
              [
                ts.createVariableDeclaration(
                  ts.createIdentifier('interfaceData'),
                  undefined,
                  ts.createObjectLiteral(jsonItem, true)
                )
              ]
            )
          )
        )
      }

      function visitor (node) {
        return ts.visitEachChild(node, visitor, ctx)
      }
      return ts.visitEachChild(sourceFile, visitor, ctx)
    }
  }]
}
