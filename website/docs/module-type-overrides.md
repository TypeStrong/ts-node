---
title: Module type overrides
---

When deciding between CommonJS and native ECMAScript modules, `ts-node` defaults to matching vanilla `node` and `tsc`
behavior.  This means TypeScript files are transformed according to your `tsconfig.json` `"module"` option and executed
according to node's rules for the `package.json` `"type"` field.

In some projects you may need to override this behavior for some files.  For example, in a webpack
project, you may have `package.json` configured with `"type": "module"` and `tsconfig.json` with
`"module": "esnext"`.  However, webpack uses our CommonJS hook to execute your `webpack.config.ts`,
so you need to force your webpack config and any supporting scripts to execute as CommonJS.

In these situations, our `moduleTypes` option lets you override certain files, forcing execution as
CommonJS or ESM.  Node supports similar overriding via `.cjs` and `.mjs` file extensions, but `.ts` files cannot use them.
`moduleTypes` achieves the same effect, and *also* overrides your `tsconfig.json` `"module"` config appropriately.

The following example tells `ts-node` to execute a webpack config as CommonJS:

```json title=tsconfig.json
{
  "ts-node": {
    "transpileOnly": true,
    "moduleTypes": {
      "webpack.config.ts": "cjs",
      // Globs are also supported with the same behavior as tsconfig "include"
      "webpack-config-scripts/**/*": "cjs"
    }
  },
  "compilerOptions": {
    "module": "es2020",
    "target": "es2020"
  }
}
```

Each key is a glob pattern with the same syntax as tsconfig's `"include"` array.
When multiple patterns match the same file, the last pattern takes precedence.

* `cjs` overrides matches files to compile and execute as CommonJS.
* `esm` overrides matches files to compile and execute as native ECMAScript modules.
* `package` resets either of the above to default behavior, which obeys `package.json` `"type"` and `tsconfig.json` `"module"` options.

## Caveats

Files with an overridden module type are transformed with the same limitations as [`isolatedModules`](https://www.typescriptlang.org/tsconfig#isolatedModules).  This will only affect rare cases such as using `const enum`s with [`preserveConstEnums`](https://www.typescriptlang.org/tsconfig#preserveConstEnums) disabled.

This feature is meant to faciliate scenarios where normal `compilerOptions` and `package.json` configuration is not possible.  For example, a `webpack.config.ts` cannot be given its own `package.json` to override `"type"`.  Wherever possible you should favor using traditional `package.json` and `tsconfig.json` configurations.
