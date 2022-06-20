import type { NodeLoaderHooksAPI1, NodeLoaderHooksAPI2 } from '..';
import { filterHooksByAPIVersion, NodeLoaderHooksAPI3 } from '../esm';

type IHooks = NodeLoaderHooksAPI1 & NodeLoaderHooksAPI2 & NodeLoaderHooksAPI3;
type UHooks = NodeLoaderHooksAPI1 | NodeLoaderHooksAPI2 | NodeLoaderHooksAPI3;
let hooks: IHooks;

/** @internal */
export function lateBindHooks(_hooks: UHooks) {
  hooks = _hooks as IHooks;
}

const proxy: NodeLoaderHooksAPI1 & NodeLoaderHooksAPI2 & NodeLoaderHooksAPI3 = {
  // @ts-expect-error incompatibility between API2 async and API3 sync
  resolve(...args: Parameters<NodeLoaderHooksAPI2.ResolveHook>) {
    return (hooks?.resolve ?? args[2])(...args);
  },
  load(...args: Parameters<NodeLoaderHooksAPI2.LoadHook>) {
    return (hooks?.load ?? args[2])(...args);
  },
  getFormat(...args: Parameters<NodeLoaderHooksAPI1.GetFormatHook>) {
    return (hooks?.getFormat ?? args[2])(...args);
  },
  transformSource(
    ...args: Parameters<NodeLoaderHooksAPI1.TransformSourceHook>
  ) {
    return (hooks?.transformSource ?? args[2])(...args);
  },
};

/** @internal */
export const { resolve, load, getFormat, transformSource } =
  filterHooksByAPIVersion(proxy) as IHooks;
