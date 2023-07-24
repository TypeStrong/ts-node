import semver from 'semver';
import { URL } from 'url';
import { createRequire } from 'module';

export const protocol = 'testloader://';

const newHooksAPI = semver.gte(process.versions.node, '16.12.0');

let hooks = undefined;

const require = createRequire(import.meta.url);

//
// Commands
//

export const clearLoaderCmd = 'clearLoader';
function clearLoader() {
  hooks = undefined;
}

export const setLoaderCmd = 'setLoader';
function setLoader(specifier, options) {
  const tsNode = require(specifier);
  const service = tsNode.create(options);
  hooks = tsNode.createEsmHooks(service);
}

//
// Loader hooks
//

function createHook(name) {
  return function (a, b, c) {
    const target = (hooks && hooks[name]) || c;
    return target(...arguments);
  };
}

export const empty = `${protocol}empty`;
const resolveEmpty = { url: empty, shortCircuit: true };

const _resolve = createHook('resolve');
export function resolve(specifier, ...rest) {
  if (specifier.startsWith(protocol)) {
    const url = new URL(specifier);
    switch (url.host) {
      case setLoaderCmd:
        const specifier = url.searchParams.get('specifier');
        const options = JSON.parse(url.searchParams.get('options'));
        setLoader(specifier, options);
        return resolveEmpty;
      case clearLoaderCmd:
        clearLoader();
        return resolveEmpty;
    }
  }
  return _resolve(specifier, ...rest);
}

const _loadHook = newHooksAPI ? createHook('load') : null;
function _load(url, ...rest) {
  if (url === empty) return { format: 'module', source: '', shortCircuit: true };
  return _loadHook(url, ...rest);
}
export const load = newHooksAPI ? _load : null;

export const getFormat = !newHooksAPI ? createHook('getFormat') : null;
export const transformSource = !newHooksAPI ? createHook('transformSource') : null;
