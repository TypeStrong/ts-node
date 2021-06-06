import {hasOwnProperty} from './util';
/*
 * cache entries are stored by: (via nested JS objects)
 * - project hash (ts-node, ts, swc version numbers, config object hash)
 * - abs file path
 * - file size
 * - file hash
 */

export function createCache<T>(cacheString?: string) {
  let _cache = {};
  if(cacheString) {
    try {
      _cache = JSON.parse(cacheString);
    } catch(e) {}
  }
  const cache = _cache;
  let dirty = false;
  function getRoot() {
    return cache;
  }
  function getSubcache(subcache: any, key: string) {
    return hasOwnProperty(subcache, key) ? subcache[key] : undefined;
  }
  function getOrCreateSubcache(subcache: any, key: string) {
    if(hasOwnProperty(subcache, key)) {
      return subcache[key];
    }
    const newSubcache = {};
    subcache[key] = newSubcache;
    return newSubcache;
  }
  function setEntry(cacheFrom: any, subcacheKey: string, value: T) {
    cacheFrom[subcacheKey] = value;
    dirty = true;
  }
  function getEntry(cacheFrom: any, subcacheKey: string): T {
    return hasOwnProperty(cacheFrom, subcacheKey) ? cacheFrom[subcacheKey] : undefined;
  }
  function serializeToString() {
    return JSON.stringify(cache);
  }
  function registerCallbackOnProcessExitAndDirty(cb: Function) {
    process.on('exit', () => {
      if(dirty) {
        cb();
      }
    });
  }

  return {getOrCreateSubcache, getEntry, getSubcache, setEntry, serializeToString, registerCallbackOnProcessExitAndDirty, getRoot};
}
