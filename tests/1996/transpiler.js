// A custom transpiler that returns `undefined` instead of a sourcemap, which is
// allowed according to our typedefs.

exports.create = function () {
  return {
    transpile(input, options) {
      return {
        outputText: 'console.log("#1996 regression test with custom transpiler.")',
        sourceMapText: undefined,
      };
    },
  };
};
