// Spy on the swc transpiler so that tests can prove it was used rather than
// TypeScript's `transpileModule`.
const swcTranspiler = require('ts-node/transpilers/swc');

global.swcTranspilerCalls = 0;

const wrappedCreate = swcTranspiler.create;
swcTranspiler.create = function (...args) {
  const transpiler = wrappedCreate(...args);
  const wrappedTranspile = transpiler.transpile;
  transpiler.transpile = function (...args) {
    global.swcTranspilerCalls++;
    return wrappedTranspile.call(this, ...args);
  };
  return transpiler;
};
