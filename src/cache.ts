import {hasOwnProperty} from './util';
/*
 * cache entries are stored by: (via nested JS objects)
 * - project hash (ts-node, ts, swc version numbers, config object hash)
 * - abs file path
 * - file size
 * - file hash
 */

export function createCache<T>(cacheString: string) {
  const cache = JSON.parse(cacheString);
  let dirty = false;
  function getSubcacheOf(subcache: any, key: string) {
    return hasOwnProperty(subcache, key) ? subcache[key] : undefined;
  }
  function getSubcacheOfRootCache(key: string) {
    return getSubcacheOf(cache, key);
  }
  function getOrCreateSubcacheOf(subcache: any, key: string) {
    if(hasOwnProperty(subcache, key)) {
      return subcache[key];
    }
    const newSubcache = {};
    subcache[key] = newSubcache;
    return newSubcache;
  }
  function getOrCreateSubcacheOfRoot(key: string) {
    return getOrCreateSubcacheOf(cache, key);
  }
  function setEntry(cacheFrom: any, subcacheKey: string, value: T) {
    cacheFrom[subcacheKey] = value;
    dirty = true;
  }
  function getEntry(cacheFrom: any, subcacheKey: string): T {
    return hasOwnProperty(cacheFrom, subcacheKey) ? cacheFrom[subcacheKey] : undefined;
  }
  function getCacheAsString() {
    return JSON.stringify(cache);
  }
  function registerCallbackOnProcessExitAndDirty(cb: Function) {
    process.on('exit', () => {
      if(dirty) {
        cb();
      }
    });
  }

  return {getOrCreateSubcacheOf, getOrCreateSubcacheOfRoot, getSubcacheOfRootCache, getEntry, getSubcacheOf, setEntry, getCacheAsString, registerCallbackOnProcessExitAndDirty};
}
