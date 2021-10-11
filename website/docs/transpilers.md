---
title: Third-party transpilers
---

In transpile-only mode, we skip typechecking to speed up execution time.  You can go a step further and use a
third-party transpiler to transform TypeScript into JavaScript even faster.  You will still benefit from
ts-node's automatic `tsconfig.json` discovery, sourcemap support, and global ts-node CLI.  Integrations
can automatically derive an appropriate configuration from your existing `tsconfig.json` which simplifies project
boilerplate.

> **What is the difference between a compiler and a transpiler?**
>
> For our purposes, a compiler implements TypeScript's API and can perform typechecking.
> A third-party transpiler does not.  Both transform TypeScript into JavaScript.

## Bundled `swc` integration

We have bundled an experimental `swc` integration.

[`swc`](https://swc.rs) is a TypeScript-compatible transpiler implemented in Rust.  This makes it an order of magnitude faster
than `transpileModule`.

To use it, first install `@swc/core` or `@swc/wasm`.  If using `importHelpers`, also install `@swc/helpers`, and if using `dynamicImports` also install `regenerator-runtime`.

```shell
npm i -D @swc/core @swc/helpers regenerator-runtime
```

Then add the following to your `tsconfig.json`.

```json title="tsconfig.json"
{
  "ts-node": {
    "transpileOnly": true,
    "transpiler": "ts-node/transpilers/swc-experimental"
  }
}
```

> `swc` uses `@swc/helpers` instead of `tslib`.  If you have enabled `importHelpers`, you must also install `@swc/helpers`.
> If you are using `dynamicImports`, you must install `regenerator-runtime`.

## Writing your own integration

To write your own transpiler integration, check our [API docs](https://typestrong.org/ts-node/api/interfaces/TranspilerModule.html).

Integrations are `require()`d, so they can be published to npm.  The module must export a `create` function matching the
[`TranspilerModule`](https://typestrong.org/ts-node/api/interfaces/TranspilerModule.html) interface.
