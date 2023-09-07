import type { NodeLoaderHooksAPI1, NodeLoaderHooksAPI2 } from '..';
import { filterHooksByAPIVersion } from '../esm';
import { URL } from 'url';
import { bootstrap } from '../bin';
import { versionGteLt } from '../util';
import { argPrefix, decompress } from './argv-payload';

// On node v20, we cannot lateBind the hooks from outside the loader thread
// so it has to be done in the loader thread.
export function bindFromLoaderThread(loaderURL: string) {
  // If we aren't in a loader thread, then skip this step.
  if (!versionGteLt(process.versions.node, '20.0.0')) return;

  const url = new URL(loaderURL);
  const base64Payload = url.searchParams.get(argPrefix);
  if (!base64Payload) throw new Error('unexpected loader url');
  const state = decompress(base64Payload);
  state.isInChildProcess = true;
  state.isLoaderThread = true;
  bootstrap(state);
}

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
