---
title: Module type overrides
---

> Wherever possible, it is recommended to use TypeScript's [`NodeNext` or `Node16` mode](https://www.typescriptlang.org/docs/handbook/esm-node.html) instead of the options described
in this section.  Setting `"module": "NodeNext"` and using the `.cts` file extension should work well for most projects.

When deciding how a file should be compiled and executed -- as either CommonJS or native ECMAScript module -- ts-node matches
`node` and `tsc` behavior.  This means TypeScript files are transformed according to your `tsconfig.json` `"module"`
option and executed according to node's rules for the `package.json` `"type"` field.  Set `"module": "NodeNext"` and everything should work.

In rare cases, you may need to override this behavior for some files.  For example, some tools read a `name-of-tool.config.ts`
and require that file to execute as CommonJS.  If you have `package.json` configured with `"type": "module"` and `tsconfig.json` with
`"module": "esnext"`, the config is native ECMAScript by default and will raise an error.  You will need to force the config and
any supporting scripts to execute as CommonJS.

In these situations, our `moduleTypes` option can override certain files to be
CommonJS or ESM.  Similar overriding is possible by using `.mts`, `.cts`, `.cjs` and `.mjs` file extensions.
`moduleTypes` achieves the same effect for `.ts` and `.js` files, and *also* overrides your `tsconfig.json` `"module"`
config appropriately.

The following example tells ts-node to execute a webpack config as CommonJS:

```json title="tsconfig.json"
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

This feature is meant to facilitate scenarios where normal `compilerOptions` and `package.json` configuration is not possible.  For example, a `webpack.config.ts` cannot be given its own `package.json` to override `"type"`.  Wherever possible you should favor using traditional `package.json` and `tsconfig.json` configurations.
