---
title: How It Works
---

`ts-node` works by registering the TypeScript compiler for `.ts`, `.tsx`, `.js`, and `.jsx` extensions. `.js` and `.jsx` are only registered when [`allowJs`](https://www.typescriptlang.org/docs/handbook/compiler-options.html#compiler-options) is enabled.
`.tsx` and `.jsx` are only registered when [`jsx`](https://www.typescriptlang.org/docs/handbook/jsx.html) is enabled.

When node.js has an extension registered (via `require.extensions`), it will use the extension internally for module resolution. When an extension is unknown to node.js, it handles the file as `.js` (JavaScript). By default, **TypeScript Node** avoids compiling files in `/node_modules/` for three reasons:

1. Modules should always be published in a format node.js can consume
2. Transpiling the entire dependency tree will make your project slower
3. Differing behaviours between TypeScript and node.js (e.g. ES2015 modules) can result in a project that works until you decide to support a feature natively from node.js

**P.S.** This means if you don't register an extension, it is compiled as JavaScript. When `ts-node` is used with `allowJs`, JavaScript files are transpiled using the TypeScript compiler.
