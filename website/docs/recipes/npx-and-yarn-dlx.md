---
title: npx and yarn dlx
---

Using [`npx`](https://docs.npmjs.com/cli/v8/commands/npx) or [`yarn dlx`](https://yarnpkg.com/cli/dlx) is a great ways to publish reusable TypeScript tools to GitHub without precompiling or packaging.

Check out our working example: [TypeStrong/ts-node-npx-example](https://github.com/TypeStrong/ts-node-npx-example)

```shell
npx typestrong/ts-node-npx-example --help
npx typestrong/ts-node-npx-example --first Arthur --last Dent
```

TODO publish demo and link to it
TODO test demo:
  - uninstall global ts-node
  - try running demo
  - does ts-node need to be installed globally?

This boilerplate is a good starting point:

```json title="package.json"
{
  "bin": "./cli.ts",
  "dependencies": {
    "ts-node": "latest",
    "@swc/core": "latest",
    "@swc/helpers": "latest",
    "@tsconfig/node16": "latest"
  }
}
```

```json title="tsconfig.json"
{
  "extends": "@tsconfig/node16/tsconfig.json",
  "ts-node": {
    "swc": true
  }
}
```

```typescript twoslash title="cli.ts"
#!/usr/bin/env ts-node

console.log("Hello world!")
```

If you require native ESM support, use `ts-node-esm` in your shebang and follow the configuration instructions for ESM: [Native ECMAScript modules](../commonjs-vs-native-ecmascript-modules.md#native-ecmascript-modules)

```typescript twoslash title="cli.ts"
#!/usr/bin/env ts-node-esm
```
