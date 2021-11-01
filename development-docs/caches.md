Lots of caching in ts-node.

## Caches

### FS cache:
caches results of primitive ts.sys.readFile, etc operations
Shared across compiler and config loader

### fileContents (and fileVersions) cache:
sits in front of fs cache.
Node.js module loading mechanism reads file contents from disk.  That's put into this cache.

### Output cache:
Caches the emitted JS syntax from compilation.
Has appended //# sourcemap comments.
source-map-support reads from here before fallback to filesystem.

### source-map-support cache:
caches fs.readFile calls
overlayed by output cache above
overlayed by sourcesContents from parsed sourcemaps

### SourceFile cache: (does not exist today)
for Compiler API codepath
to avoid re-parsing SourceFile repeatedly

## Questions

If both:
- source-map-support caches a sourcesContents string of a .ts file
- cachedFsReader caches the same .ts file from disk
...which is used by source-map-support?  Does it matter since they should be identical?
