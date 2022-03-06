---
title: Troubleshooting
---

## Understanding configuration

ts-node uses sensible default configurations to reduce boilerplate while still respecting `tsconfig.json` if you
have one.  If you are unsure which configuration is used, you can log it with `ts-node --showConfig`.  This is similar to
`tsc --showConfig` but includes `"ts-node"` options as well.

ts-node also respects your locally-installed `typescript` version, but global installations fallback to the globally-installed
`typescript`.  If you are unsure which versions are used, `ts-node -vv` will log them.

```shell
$ ts-node -vv
ts-node v10.0.0
node v16.1.0
compiler v4.2.2

$ ts-node --showConfig
{
  "compilerOptions": {
    "target": "es6",
    "lib": [
      "es6",
      "dom"
    ],
    "rootDir": "./src",
    "outDir": "./.ts-node",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "declaration": false,
    "sourceMap": true,
    "inlineSources": true,
    "types": [
      "node"
    ],
    "stripInternal": true,
    "incremental": true,
    "skipLibCheck": true,
    "importsNotUsedAsValues": "error",
    "inlineSourceMap": false,
    "noEmit": false
  },
  "ts-node": {
    "cwd": "/d/project",
    "projectSearchDir": "/d/project",
    "require": [],
    "project": "/d/project/tsconfig.json"
  }
}
```

## Understanding Errors

It is important to differentiate between errors from ts-node, errors from the TypeScript compiler, and errors from `node`.  It is also important to understand when errors are caused by a type error in your code, a bug in your code, or a flaw in your configuration.

### `TSError`

Type errors from the compiler are thrown as a `TSError`.  These are the same as errors you get from `tsc`.

### `SyntaxError`

Any error that is not a `TSError` is from node.js (e.g. `SyntaxError`), and cannot be fixed by TypeScript or ts-node. These are bugs in your code or configuration.

#### Unsupported JavaScript syntax

Your version of `node` may not support all JavaScript syntax supported by TypeScript.  The compiler must transform this syntax via "downleveling," which is controlled by
the [tsconfig `"target"` option](https://www.typescriptlang.org/tsconfig#target).  Otherwise your code will compile fine, but node will throw a `SyntaxError`.

For example, `node` 12 does not understand the `?.` optional chaining operator.  If you use `"target": "esnext"`, then the following TypeScript syntax:

```typescript twoslash
export {};
var foo: {bar: string} | undefined;
// ---cut---
const bar: string | undefined = foo?.bar;
```

will compile into this JavaScript:

```javascript
const a = foo?.bar;
```

When you try to run this code, node 12 will throw a `SyntaxError`.  To fix this, you must switch to `"target": "es2019"` or lower so TypeScript transforms `?.` into something `node` can understand.

### `ERR_REQUIRE_ESM`

This error is thrown by node when a module is `require()`d, but node believes it should execute as native ESM.  This can happen for a few reasons:

- You have installed an ESM dependency but your own code compiles to CommonJS.
  - Solution: configure your project to compile and execute as native ESM. [Docs](./imports.md#native-ecmascript-modules)
  - Solution: downgrade the dependency to an older, CommonJS version.
- You have moved your project to ESM but still have a config file, such as `webpack.config.js`, which must be executed as CommonJS
  - Solution: if supported by the relevant tool, rename your config file to `.cjs`
  - Solution: Configure a module type override. [Docs](./module-type-overrides.md)
- You have a mix of CommonJS and native ESM in your project
  - Solution: double-check all package.json "type" and tsconfig.json "module" configuration [Docs](./imports.md)
  - Solution: consider simplifying and switch to all CommonJS or all native ESM

### `ERR_UNKNOWN_FILE_EXTENSION`

This error is thrown by node when a module has an unrecognized file extension, or no extension at all, and is being executed as native ESM.  This can happen for a few reasons:

- You are using a tool which has an extensionless binary, such as `mocha`.
  - CommonJS supports extensionless files but native ESM does not.
  - Solution: upgrade to ts-node >=[v10.6.0](https://github.com/TypeStrong/ts-node/releases/tag/v10.6.0), which implements a workaround.
- Our ESM loader is not installed.
  - Solution: Use `ts-node-esm`, `ts-node --esm`, or add `"ts-node": {"esm": true}` to your tsconfig.json.  [Docs](./imports.md#native-ecmascript-modules)
