---
title: "Imports: CommonJS vs native modules"
---

TypeScript should almost always be written using modern `import` and `export` syntax.  However, you can either downlevel it to CommonJS or use node's native ESM support.  You do not need to use node's native ECMAScript modules support to use `import` syntax.

## CommonJS (recommended)

We recommend downleveling to CommonJS.  To do this, you must set `"module": "CommonJS"` in your `tsconfig.json` or compiler options, and remove or set `"type": "commonjs"` in your `package.json`.

```json title="tsconfig.json"
{
  "compilerOptions": {
    "module": "CommonJS"
  }
}
```

```json title="package.json"
{
  // This can be omitted; commonjs is the default
  "type": "commonjs"
}
```

See also: https://nodejs.org/api/packages.html#packages_type

## Native ECMAScript modules

Node's native ESM loader hooks are currently experimental and so is `ts-node`'s ESM loader hook.  This means breaking changes may happen in minor and patch releases, and it is not recommended for production.

For usage, limitations, and to provide feedback, see [#1007](https://github.com/TypeStrong/ts-node/issues/1007).
