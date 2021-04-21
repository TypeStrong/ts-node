---
title: Third-party transpilers
---

In transpile-only mode, we skip typechecking to speed up execution time.  You can go a step further and use a
third-party transpiler to transform TypeScript into JavaScript even faster.  You will still benefit from
`ts-node`'s automatic `tsconfig.json` configuration, sourcemap support, and global `ts-node` CLI command.  Integrations
can also automatically derive an appropriate configuration from your existing `tsconfig.json` which simplifies project
configuration.

## Bundled `swc` transpiler

We have bundled an experimental `swc` integration.

[`swc`](https://swc.rs) is a TypeScript-compatible transpiler implemented in Rust.  This makes it an order of magnitude faster
than `transpileModule`.

To use it, first install `@swc/core` or `@swc/wasm`.

```shell
npm i -D @swc/core
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

## Write your own integration

To write your own transpiler integration, check our [API docs](https://typestrong.org/ts-node/api/).

Integrations are `require()`d, so they can be published to npm.
