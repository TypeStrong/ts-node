## Musings about resolving between rootDir and outDir

When /dist and /src are understood to be overlaid because of src -> dist compiling
/dist/
/src/

Loop over require.extensions
/src/foo.js
/src/foo.mjs
/src/foo.cjs
/src/foo.ts
/src/foo.mts
/src/foo.cts
/src/foo/index.js
/src/foo/index.mjs
/src/foo/index.ts
// Where do we check package.json main??


/dist/foo.js
/dist/foo.ts


_resolveLookupPaths
_findPath
_resolveFilename

_findPath calls resolveExports calls packageExportsResolve, which is in the ESM loader

Is anything within packageExportsResolve hooked/modified by us?  File extension swapping?


When resolver calls statSync('./dist/foo.js') and we intercept and discover './src/foo.ts'
How to redirect?  We need to rewrite whatever local variable is storing `./dist/foo.js`
