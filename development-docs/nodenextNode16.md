# Adding support for NodeNext, Node16, `.cts`, `.mts`, `.cjs`, `.mjs`

*This feature has already been implemented.  Here are my notes from when
I was doing the work*

## TODOs

Implement node module type classifier:
- if NodeNext or Node12: ask classifier for CJS or ESM determination
Add `ForceNodeNextCJSEmit`

Does our code check for .d.ts extensions anywhere?
- if so, teach it about .d.cts and .d.mts

For nodenext and node12, support supplemental "flavor" information:
-

Think about splitting out index.ts further:
- register.ts - hooking stuff
- types.ts
- env.ts - env vars and global registration types (process.symbol)
- service.ts

# TESTS

Matrix:

- package.json type absent, commonjs, and module
- import and require
- from cjs and esm
- .cts, .cjs
- .mts, .mjs
- typechecking, transpileOnly, and swc
- dynamic import
- import = require
- static import
- allowJs on and off

Notes about specific matrix entries:
- require mjs, mts from cjs throws error

Rethink:
`getOutput`: null in transpile-only mode.  Also may return emitskipped
`getOutputTranspileOnly`: configured module option
`getOutputForceCommonJS`: `commonjs` module option
`getOutputForceNodeCommonJS`: `nodenext` cjs module option
`getOutputForceESM`: `esnext` module option

Add second layer of classification to classifier:
if classifier returns `auto` (no `moduleType` override)
- if `getOutput` emits, done
- else call `nodeModuleTypeClassifier`
  - delegate to appropriate `getOutput` based on its response
