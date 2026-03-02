---
title: Troubleshooting
---

## Configuration

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

## Common errors

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
  - Solution: configure your project to compile and execute as native ESM. [Docs](./commonjs-vs-native-ecmascript-modules.md#native-ecmascript-modules)
  - Solution: downgrade the dependency to an older, CommonJS version.
- You have moved your project to ESM but still have a config file, such as `webpack.config.ts`, which must be executed as CommonJS <!-- SYNC_WITH_MTO_DOCS -->
  - Solution: if supported by the relevant tool, rename your config file to `.cts`
  - Solution: Configure a module type override. [Docs](./module-type-overrides.md)
- You have a mix of CommonJS and native ESM in your project
  - Solution: double-check all package.json "type" and tsconfig.json "module" configuration [Docs](./commonjs-vs-native-ecmascript-modules.md)
  - Solution: consider simplifying by making your project entirely CommonJS or entirely native ESM

### `ERR_UNKNOWN_FILE_EXTENSION`

This error is thrown by node when a module has an unrecognized file extension, or no extension at all, and is being executed as native ESM.  This can happen for a few reasons:

- You are using a tool which has an extensionless binary, such as `mocha`.
  - CommonJS supports extensionless files but native ESM does not.
  - Solution: upgrade to ts-node >=[v10.6.0](https://github.com/TypeStrong/ts-node/releases/tag/v10.6.0), which implements a workaround.
- Our ESM loader is not installed.
  - Solution: Use `ts-node-esm`, `ts-node --esm`, or add `"ts-node": {"esm": true}` to your tsconfig.json.  [Docs](./commonjs-vs-native-ecmascript-modules.md#native-ecmascript-modules)
- You have moved your project to ESM but still have a config file, such as `webpack.config.ts`, which must be executed as CommonJS <!-- SYNC_WITH_MTO_DOCS -->
  - Solution: if supported by the relevant tool, rename your config file to `.cts`
  - Solution: Configure a module type override. [Docs](./module-type-overrides.md)

## Missing Types

ts-node does _not_ eagerly load `files`, `include` or `exclude` by default. This is because a large majority of projects do not use all of the files in a project directory (e.g. `Gulpfile.ts`, runtime vs tests) and parsing every file for types slows startup time. Instead, ts-node starts with the script file (e.g. `ts-node index.ts`) and TypeScript resolves dependencies based on imports and references.

Occasionally, this optimization leads to missing types. Fortunately, there are other ways to include them in typechecking.

For global definitions, you can use the `typeRoots` compiler option.  This requires that your type definitions be structured as type packages (not loose TypeScript definition files). More details on how this works can be found in the [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html#types-typeroots-and-types).

Example `tsconfig.json`:

```json
{
  "compilerOptions": {
    "typeRoots" : ["./node_modules/@types", "./typings"]
  }
}
```

Example project structure:

```text
<project_root>/
-- tsconfig.json
-- typings/
  -- <module_name>/
    -- index.d.ts
```

Example module declaration file:

```typescript twoslash
declare module '<module_name>' {
    // module definitions go here
}
```

For module definitions, you can use [`paths`](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping):

```json title="tsconfig.json"
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "custom-module-type": ["types/custom-module-type"]
    }
  }
}
```

Another option is [triple-slash directives](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html). This may be helpful if you prefer not to change your `compilerOptions` or structure your type definitions for `typeRoots`. Below is an example of a triple-slash directive as a relative path within your project:

```typescript twoslash
/// <reference path="./types/lib_greeter" />
import {Greeter} from "lib_greeter"
const g = new Greeter();
g.sayHello();
```

If none of the above work, and you _must_ use `files`, `include`, or `exclude`, enable our [`files`](./options.md#files) option.

## npx, yarn dlx, and node_modules

When executing TypeScript with `npx` or `yarn dlx`, the code resides within a temporary `node_modules` directory.

The contents of `node_modules` are ignored by default.  If execution fails, enable [`skipIgnore`](./options.md#skipignore).

<!--See also: [npx and yarn dlx](./recipes/npx-and-yarn-dlx.md)-->
