---
title: How It Works
---

ts-node works by registering hooks for `.ts`, `.tsx`, `.js`, and/or `.jsx` extensions.

Vanilla `node` loads `.js` by reading code from disk and executing it.  Our hook runs in the middle, transforming code from TypeScript to JavaScript and passing the result to `node` for execution.  This transformation will respect your `tsconfig.json` as if you had compiled via `tsc`.

`.js` and `.jsx` are only transformed when [`allowJs`](https://www.typescriptlang.org/docs/handbook/compiler-options.html#compiler-options) is enabled.

`.tsx` and `.jsx` are only transformed when [`jsx`](https://www.typescriptlang.org/docs/handbook/jsx.html) is enabled.

> **Warning:** if a file is ignored or its file extension is not registered, node will either fail to resolve the file or will attempt to execute it as JavaScript without any transformation.  This may cause syntax errors or other failures, because node does not understand TypeScript type syntax nor bleeding-edge ECMAScript features.

> **Warning:** When ts-node is used with `allowJs`, all non-ignored JavaScript files are transformed using the TypeScript compiler.

## Skipping `node_modules`

By default, **TypeScript Node** avoids compiling files in `/node_modules/` for three reasons:

1. Modules should always be published in a format node.js can consume
2. Transpiling the entire dependency tree will make your project slower
3. Differing behaviours between TypeScript and node.js (e.g. ES2015 modules) can result in a project that works until you decide to support a feature natively from node.js

If you need to import uncompiled TypeScript within `node_modules`, use [`--skipIgnore`](./options#transpilation) or [`TS_NODE_SKIP_IGNORE`](./options#transpilation) to bypass this restriction.

## Skipping precompiled TypeScript

If a compiled JavaScript file with the same name as a TypeScript file already exists, the TypeScript file will be ignored.  ts-node will execute the pre-compiled JavaScript.

To force ts-node to compile the TypeScript source, not the precompiled JavaScript, use [`--preferTsExts`](./options#transpilation).
