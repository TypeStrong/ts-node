import type { NodeLoaderHooksAPI1, NodeLoaderHooksAPI2 } from '..';
import { filterHooksByAPIVersion } from '../esm';

let hooks: NodeLoaderHooksAPI1 & NodeLoaderHooksAPI2;

/** @internal */
export function lateBindHooks(_hooks: NodeLoaderHooksAPI1 | NodeLoaderHooksAPI2) {
  hooks = _hooks as NodeLoaderHooksAPI1 & NodeLoaderHooksAPI2;
}

const proxy: NodeLoaderHooksAPI1 & NodeLoaderHooksAPI2 = {
  resolve(...args: Parameters<NodeLoaderHooksAPI1['resolve']>) {
    return (hooks?.resolve ?? args[2])(...args);
  },
  load(...args: Parameters<NodeLoaderHooksAPI2['load']>) {
    return (hooks?.load ?? args[2])(...args);
  },
  getFormat(...args: Parameters<NodeLoaderHooksAPI1['getFormat']>) {
    return (hooks?.getFormat ?? args[2])(...args);
  },
  transformSource(...args: Parameters<NodeLoaderHooksAPI1['transformSource']>) {
    return (hooks?.transformSource ?? args[2])(...args);
  },
};

/** @internal */
export const { resolve, load, getFormat, transformSource } = filterHooksByAPIVersion(proxy) as NodeLoaderHooksAPI1 &
  NodeLoaderHooksAPI2;
