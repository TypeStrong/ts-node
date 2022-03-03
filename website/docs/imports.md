---
title: "CommonJS vs native ECMAScript modules"
---

TypeScript is almost always written using modern `import` syntax, but it is also transformed before being executed by the underlying runtime.  You can choose to either transform to CommonJS or to preserve the native `import` syntax, using node's native ESM support.  Configuration is different for each.

Here is a brief comparison of the two.

| CommonJS | Native ECMAScript modules |
|---|---|
| Write native `import` syntax | Write native `import` syntax |
| Transforms `import` into `require()` | Does not transform `import` |
| Node executes scripts using the classic [CommonJS loader](https://nodejs.org/dist/latest-v16.x/docs/api/modules.html) | Node executes scripts using the new [ESM loader](https://nodejs.org/dist/latest-v16.x/docs/api/esm.html) |
| Use any of:<br/>ts-node CLI<br/>`node -r ts-node/register`<br/>`NODE_OPTIONS="ts-node/register" node`<br/>`require('ts-node').register({/* options */})` | Must use the ESM loader via:<br/>`node --loader ts-node/esm`<br/>`NODE_OPTIONS="--loader ts-node/esm" node` |

## CommonJS

Transforming to CommonJS is typically simpler and more widely supported because it is older.  You must remove [`"type": "module"`](https://nodejs.org/api/packages.html#packages_type) from `package.json` and set [`"module": "CommonJS"`](https://www.typescriptlang.org/tsconfig/#module) in `tsconfig.json`.

```json title="package.json"
{
  // This can be omitted; commonjs is the default
  "type": "commonjs"
}
```

```json tsconfig title="tsconfig.json"
{
  "compilerOptions": {
    "module": "CommonJS"
  }
}
```

If you must keep `"module": "ESNext"` for `tsc`, webpack, or another build tool, you can set an override for ts-node.

```json tsconfig title="tsconfig.json"
{
  "compilerOptions": {
    "module": "ESNext"
  },
  "ts-node": {
    "compilerOptions": {
      "module": "CommonJS"
    }
  }
}
```

## Native ECMAScript modules

[Node's ESM loader hooks](https://nodejs.org/api/esm.html#esm_experimental_loaders) are [**experimental**](https://nodejs.org/api/documentation.html#documentation_stability_index) and subject to change. ts-node's ESM support is as stable as possible, but it relies on APIs which node can *and will* break in new versions of node.  Thus it is not recommended for production.

For complete usage, limitations, and to provide feedback, see [#1007](https://github.com/TypeStrong/ts-node/issues/1007).

You must set [`"type": "module"`](https://nodejs.org/api/packages.html#packages_type) in `package.json` and [`"module": "ESNext"`](https://www.typescriptlang.org/tsconfig/#module) in `tsconfig.json`.

```json title="package.json"
{
  "type": "module"
}
```

```json tsconfig title="tsconfig.json"
{
  "compilerOptions": {
    "module": "ESNext" // or ES2015, ES2020
  }
}
```
