---
title: Transpilers
---

ts-node supports third-party transpilers as plugins.  Transpilers such as swc can transform TypeScript into JavaScript
much faster than the TypeScript compiler.  You will still benefit from ts-node's automatic `tsconfig.json` discovery,
sourcemap support, and global ts-node CLI. Plugins automatically derive an appropriate configuration from your existing
`tsconfig.json` which simplifies project boilerplate.

> **What is the difference between a compiler and a transpiler?**
>
> For our purposes, a compiler implements TypeScript's API and can perform typechecking.
> A third-party transpiler does not.  Both transform TypeScript into JavaScript.

## Third-party plugins

The `transpiler` option allows using third-party transpiler plugins with ts-node.  `transpiler` must be given the
name of a module which can be `require()`d.  The built-in `swc` plugin is exposed as `ts-node/transpilers/swc`.

For example, to use a hypothetical "@cspotcode/fast-ts-compiler", first install it into your project: `npm install @cspotcode/fast-ts-compiler`

Then add the following to your tsconfig:

```json title="tsconfig.json"
{
  "ts-node": {
    "transpileOnly": true,
    "transpiler": "@cspotcode/fast-ts-compiler"
  }
}
```

## Write your own plugin

To write your own transpiler plugin, check our [API docs](https://typestrong.org/ts-node/api/interfaces/TranspilerModule.html).

Plugins are `require()`d by ts-node, so they can be a local script or a node module published to npm.  The module must
export a `create` function described by our
[`TranspilerModule`](https://typestrong.org/ts-node/api/interfaces/TranspilerModule.html) interface.  `create` is
invoked by ts-node at startup to create one or more transpiler instances.  The instances are used to transform
TypeScript into JavaScript.

For a working example, check out out our bundled swc plugin: https://github.com/TypeStrong/ts-node/blob/main/src/transpilers/swc.ts
