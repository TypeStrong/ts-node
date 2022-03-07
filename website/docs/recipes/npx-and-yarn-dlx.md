---
title: npx and yarn dlx
---

Using [`npx`](https://docs.npmjs.com/cli/v8/commands/npx) or [`yarn dlx`](https://yarnpkg.com/cli/dlx) is a great ways to publish reusable TypeScript tools to GitHub without precompiling or packaging.

```shell
npx typestrong/ts-node-npx-demo --help
npx typestrong/ts-node-npx-demo --first Arthur --last Dent
```

TODO publish demo and link to it
TODO test demo:
  - uninstall global ts-node
  - try running demo
  - does ts-node need to be installed globally?

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
