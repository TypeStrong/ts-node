// Grant ourselves the ability to install ESM loader behaviors in-process during tests

let hooks = undefined;
process.__test_setloader__ = function (_hooks) {
  hooks = _hooks;
};
function resolve(a, b, c) {
  const target = hooks?.resolve ?? c;
  return target(...arguments);
}
function load(a, b, c) {
  const target = hooks?.load ?? c;
  return target(...arguments);
}

export { resolve, load };
