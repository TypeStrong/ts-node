// Grant ourselves the ability to install ESM loader behaviors in-process during tests
import semver from 'semver';

const newHooksAPI = semver.gte(process.versions.node, '16.12.0');

let hooks = undefined;
process.__test_setloader__ = function (_hooks) {
  hooks = _hooks;
};
function createHook(name) {
  return function (a, b, c) {
    const target = (hooks && hooks[name]) || c;
    return target(...arguments);
  };
}
export const resolve = createHook('resolve');
export const load = newHooksAPI ? createHook('load') : null;
export const getFormat = !newHooksAPI ? createHook('getFormat') : null;
export const transformSource = !newHooksAPI ? createHook('transformSource') : null;
