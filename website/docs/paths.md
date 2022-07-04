---
title: |
  paths and baseUrl
---

You can use ts-node together with [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) to load modules according to the `paths` section in `tsconfig.json`.

```json title="tsconfig.json"
{
  "ts-node": {
    // Do not forget to `npm i -D tsconfig-paths`
    "require": ["tsconfig-paths/register"]
  }
}
```

## Why is this not built-in to ts-node?

The official TypeScript Handbook explains the intended purpose for `"paths"` in ["Additional module resolution flags"](https://www.typescriptlang.org/docs/handbook/module-resolution.html#additional-module-resolution-flags).

> The TypeScript compiler has a set of additional flags to *inform* the compiler of transformations that are expected to happen to the sources to generate the final output.
>
> It is important to note that the compiler will not perform any of these transformations; it just uses these pieces of information to guide the process of resolving a module import to its definition file.

This means `"paths"` are intended to describe mappings that the build tool or runtime *already* performs, not to tell the build tool or
runtime how to resolve modules.  In other words, they intend us to write our imports in a way `node` already understands.  For this reason, ts-node does not modify `node`'s module resolution behavior to implement `"paths"` mappings.
