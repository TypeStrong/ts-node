---
title: Configuration
---

ts-node supports a variety of options which can be specified via `tsconfig.json`, as CLI flags, as environment variables, or programmatically.

For a complete list, see [Options](./options.md).

## CLI flags

ts-node CLI flags must come *before* the entrypoint script. For example:

```shell
$ ts-node --project tsconfig-dev.json say-hello.ts Ronald
Hello, Ronald!
```

## Via tsconfig.json (recommended)

ts-node automatically finds and loads `tsconfig.json`.  Most ts-node options can be specified in a `"ts-node"` object using their programmatic, camelCase names. We recommend this because it works even when you cannot pass CLI flags, such as `node --require ts-node/register` and when using shebangs.

Use `--skipProject` to skip loading the `tsconfig.json`.  Use `--project` to explicitly specify the path to a `tsconfig.json`.

When searching, it is resolved using [the same search behavior as `tsc`](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html). By default, this search is performed relative to the entrypoint script. In `--cwdMode` or if no entrypoint is specified -- for example when using the REPL -- the search is performed relative to `--cwd` / `process.cwd()`.

You can use this sample configuration as a starting point:

```json title="tsconfig.json"
{
  // This is an alias to @tsconfig/node16: https://github.com/tsconfig/bases
  "extends": "ts-node/node16/tsconfig.json",

  // Most ts-node options can be specified here using their programmatic names.
  "ts-node": {
    // It is faster to skip typechecking.
    // Remove if you want ts-node to do typechecking.
    "transpileOnly": true,

    "files": true,

    "compilerOptions": {
      // compilerOptions specified here will override those declared below,
      // but *only* in ts-node.  Useful if you want ts-node and tsc to use
      // different options with a single tsconfig.json.
    }
  },
  "compilerOptions": {
    // typescript options here
  }
}
```

Our bundled [JSON schema](https://unpkg.com/browse/ts-node@latest/tsconfig.schema.json) lists all compatible options.

### @tsconfig/bases

[@tsconfig/bases](https://github.com/tsconfig/bases) maintains recommended configurations for several node versions.
As a convenience, these are bundled with ts-node.

```json title="tsconfig.json"
{
  "extends": "ts-node/node16/tsconfig.json",

  // Or install directly with `npm i -D @tsconfig/node16`
  "extends": "@tsconfig/node16/tsconfig.json",
}
```

### Default config

If no `tsconfig.json` is loaded from disk, ts-node will use the newest recommended defaults from
[@tsconfig/bases](https://github.com/tsconfig/bases/) compatible with your `node` and `typescript` versions.
With the latest `node` and `typescript`, this is [`@tsconfig/node16`](https://github.com/tsconfig/bases/blob/master/bases/node16.json).

Older versions of `typescript` are incompatible with `@tsconfig/node16`.  In those cases we will use an older default configuration.

When in doubt, `ts-node --showConfig` will log the configuration being used, and `ts-node -vv` will log `node` and `typescript` versions.

## `node` flags

[`node` flags](https://nodejs.org/api/cli.html) must be passed directly to `node`; they cannot be passed to the ts-node binary nor can they be specified in `tsconfig.json`

We recommend using the [`NODE_OPTIONS`](https://nodejs.org/api/cli.html#cli_node_options_options) environment variable to pass options to `node`.

```shell
NODE_OPTIONS='--trace-deprecation --abort-on-uncaught-exception' ts-node ./index.ts
```

Alternatively, you can invoke `node` directly and install ts-node via `--require`/`-r`

```shell
node --trace-deprecation --abort-on-uncaught-exception -r ts-node/register ./index.ts
```
