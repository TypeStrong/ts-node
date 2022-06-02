---
title: Quick start
---

This guide offers an opinionated configuration for a modern, fast ts-node project.

You can also view this sample project in our examples repository: TODO LINK

Install dependencies:

```
npm i -D ts-node typescript @types/node @tsconfig/node18 @swc/core
```

Create `tsconfig.json`:

```jsonc
{
    // Recommendations for a node v18 project: https://github.com/tsconfig/bases
    "extends": "@tsconfig/node18/tsconfig.json",
    "ts-node": {
        // Skip typechecking and use swc for fast startup.
        // We recommend running `tsc --noEmit` for typechecking.
        // Remove if you really want ts-node to do your typechecking.
        "swc": true,
        // Enable full ESM support.
        // You can remove this if your project is still fully CommonJS
        "esm": true,
        // Enable full NodeNext support.
        "experimentalResolver": true
    },
    "compilerOptions": {
        // Explicitly listing your global types will speed up `tsc`.
        "types": ["node"],
        // Full support for cts, mts, cjs, mjs, and package.json "type"
        "module": "NodeNext"
    }
}
```

Create entrypoint:

```

```
