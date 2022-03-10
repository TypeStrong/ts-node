---
title: SWC
---

SWC support is built-in via the `--swc` flag or `"swc": true` tsconfig option.

[SWC](https://swc.rs) is a TypeScript-compatible transpiler implemented in Rust.  This makes it an order of magnitude faster than vanilla `transpileOnly`.

To use it, first install `@swc/core` or `@swc/wasm`.  If using `importHelpers`, also install `@swc/helpers`.  If `target` is less than "es2015" and using `async`/`await` or generator functions, also install `regenerator-runtime`.

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

> SWC uses `@swc/helpers` instead of `tslib`.  If you have enabled `importHelpers`, you must also install `@swc/helpers`.
