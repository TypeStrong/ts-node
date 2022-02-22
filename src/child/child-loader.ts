// TODO same version check as ESM loader, but export stubs
// Also export a binder function that allows re-binding where the stubs
// delegate.

import type { NodeLoaderHooksAPI1, NodeLoaderHooksAPI2 } from "..";
import { filterHooksByAPIVersion } from "../esm";

let hooks: NodeLoaderHooksAPI1 & NodeLoaderHooksAPI2;

/** @internal */
export function lateBindHooks(_hooks: NodeLoaderHooksAPI1 | NodeLoaderHooksAPI2) {
  hooks = _hooks as NodeLoaderHooksAPI1 & NodeLoaderHooksAPI2;
}

const proxy: NodeLoaderHooksAPI1 & NodeLoaderHooksAPI2 = {
  resolve(...args: Parameters<NodeLoaderHooksAPI1['resolve']>) {
    return hooks.resolve(...args);
  },
  load(...args: Parameters<NodeLoaderHooksAPI2['load']>) {
    return hooks.load(...args);
  },
  getFormat(...args: Parameters<NodeLoaderHooksAPI1['getFormat']>) {
    return hooks.getFormat(...args);
  },
  transformSource(...args: Parameters<NodeLoaderHooksAPI1['transformSource']>) {
    return hooks.transformSource(...args);
  }
}

/** @internal */
export const {resolve, load, getFormat, transformSource} = filterHooksByAPIVersion(proxy) as NodeLoaderHooksAPI1 & NodeLoaderHooksAPI2;
