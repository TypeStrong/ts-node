import type * as _ts from 'typescript';
import * as fs from 'fs';
import { debugFn } from './diagnostics';
import { cachedLookup } from './util';

// Types of fs implementation:
//
// Cached fs
// Proxies to real filesystem, caches results in-memory.
// Has invalidation APIs to support `delete require.cache[foo]`
//
// Overlay fs
// Is writable.  Written contents remain in memory.
// Written contents can be serialized / deserialized.
// Read calls return from in-memory, proxy to another FS if not found.

/*

require('./dist/bar.js')
dist/bar.js exists
preferTsExts=true we should resolve to ./src/bar.ts
preferTsExts=false we should resolve to ./dist/bar.js
 - read file from the filesystem?
 - read file from the overlay fs?

*/

/** @internal */
export type NodeFsReader = {
  readFileSync(path: string, encoding: 'utf8'): string;
  statSync(path: string): fs.Stats;
};

/**
 * @internal
 * Since `useCaseSensitiveFileNames` is required to know how to cache, we expose it on the interface
 */
export type TsSysFsReader = Pick<
  _ts.System,
  | 'directoryExists'
  | 'fileExists'
  | 'getDirectories'
  | 'readDirectory'
  | 'readFile'
  | 'realpath'
  | 'resolvePath'
  | 'useCaseSensitiveFileNames'
>;
/** since I've never hit code that needs these functions implemented */
type TsSysFullFsReader = TsSysFsReader &
  Pick<_ts.System, 'getFileSize' | 'getModifiedTime'>;
type TsSysFsWriter = Pick<
  _ts.System,
  'createDirectory' | 'deleteFile' | 'setModifiedTime' | 'writeFile'
>;
type TsSysFsWatcher = Pick<_ts.System, 'watchDirectory' | 'watchFile'>;

/** @internal */
export type CachedFsReader = ReturnType<typeof createCachedFsReader>;

// Start with no caching; then add it bit by bit
/** @internal */
export function createCachedFsReader(reader: TsSysFsReader) {
  // TODO if useCaseSensitive is false, then lowercase all cache keys?

  const fileContentsCache = new Map<string, string>();
  const normalizeFileCacheKey = reader.useCaseSensitiveFileNames
    ? (key: string) => key
    : (key: string) => key.toLowerCase();

  function invalidateFileContents() {}
  function invalidateFileExistence() {}

  const sys: TsSysFsReader = {
    ...reader,
    directoryExists: cachedLookup(
      debugFn('directoryExists', reader.directoryExists)
    ),
    fileExists: cachedLookup(debugFn('fileExists', reader.fileExists)),
    getDirectories: cachedLookup(
      debugFn('getDirectories', reader.getDirectories)
    ),
    readFile: cachedLookup(debugFn('readFile', reader.readFile)),
    realpath: reader.realpath
      ? cachedLookup(debugFn('realpath', reader.realpath))
      : undefined,
    resolvePath: cachedLookup(debugFn('resolvePath', reader.resolvePath)),
  };
  const enoentError = new Error() as Error & { code: 'ENOENT' };
  enoentError.code = 'ENOENT';
  const nodeFs: NodeFsReader = {
    readFileSync(path: string, encoding: 'utf8') {
      // TODO It is unnecessarily messy to implement node's `readFileSync` on top of TS's `readFile`.  Refactor this.
      const ret = sys.readFile(path);
      if (typeof ret !== 'string') {
        throw enoentError;
      }
      return ret;
    },
    statSync: cachedLookup(
      debugFn('statSync', fs.statSync)
    ) as NodeFsReader['statSync'],
  };
  return {
    sys,
    nodeFs,
    invalidateFileContents,
    invalidateFileExistence,
  };
}
