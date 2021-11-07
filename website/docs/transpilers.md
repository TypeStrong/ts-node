---
title: Transpilers
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

## swc

swc support is built-in via the `--swc` flag or `"swc": true` tsconfig option.

[`swc`](https://swc.rs) is a TypeScript-compatible transpiler implemented in Rust.  This makes it an order of magnitude faster than vanilla `transpileOnly`.

To use it, first install `@swc/core` or `@swc/wasm`.  If using `importHelpers`, also install `@swc/helpers`.  If `target` is less than "es2015" and using either `async`/`await` or generator functions, also install `regenerator-runtime`.

```shell
npm i -D @swc/core @swc/helpers regenerator-runtime
```

Then add the following to your `tsconfig.json`.

```json title="tsconfig.json"
{
  "ts-node": {
    "swc": true
  }
}
```

> `swc` uses `@swc/helpers` instead of `tslib`.  If you have enabled `importHelpers`, you must also install `@swc/helpers`.

## Third-party transpilers

The `transpiler` option allows using third-party transpiler integrations with ts-node.  `transpiler` must be given the
name of a module which can be `require()`d.  The built-in `swc` integration is exposed as `ts-node/transpilers/swc`.

For example, to use a hypothetical "speedy-ts-compiler", first install it into your project: `npm install speedy-ts-compiler`

Then add the following to your tsconfig:

```json title="tsconfig.json"
{
  "ts-node": {
    "transpileOnly": true,
    "transpiler": "speedy-ts-compiler"
  }
}
```

## Writing your own integration

To write your own transpiler integration, check our [API docs](https://typestrong.org/ts-node/api/interfaces/TranspilerModule.html).

Integrations are `require()`d by ts-node, so they can be published to npm for convenience.  The module must export a `create` function described by our
[`TranspilerModule`](https://typestrong.org/ts-node/api/interfaces/TranspilerModule.html) interface.  `create` is invoked by ts-node
at startup to create the transpiler.  The transpiler is used repeatedly to transform TypeScript into JavaScript.
