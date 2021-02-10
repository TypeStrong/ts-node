---
title: "Imports: CommonJS vs native modules"
---

TypeScript should almost always be written using `import` and `export` syntax.  You can either compile it to CommonJS or use node's native ESM support.  You do not need to use node's native modules to use `import` syntax.

### CommonJS (recommended)

We recommend compiling to CommonJS.  To do this, you must set `"module": "CommonJS"` in your `tsconfig.json` or compiler options, and make sure your package.json does *not* have `"type": "module"`.

```
{
  "compilerOptions": {
    "module": "CommonJS"
  }
}
```

### Native ECMAScript modules

Node's native ESM loader hooks are currently experimental and so is `ts-node`'s ESM loader hook.  This means breaking changes may happen in minor and patch releases, and it is not recommended for production.

For usage, limitations, and to provide feedback, see [#1007](https://github.com/TypeStrong/ts-node/issues/1007).
