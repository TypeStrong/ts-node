---
title: Usage
---

## Command Line

```shell
# Execute a script as `node` + `tsc`.
ts-node script.ts

# Starts a TypeScript REPL.
ts-node

# Execute code with TypeScript.
ts-node -e 'console.log("Hello, world!")'

# Execute, and print, code with TypeScript.
ts-node -p -e '"Hello, world!"'

# Pipe scripts to execute with TypeScript.
echo 'console.log("Hello, world!")' | ts-node

# Equivalent to ts-node --transpileOnly
ts-node-transpile-only script.ts

# Equivalent to ts-node --cwdMode
ts-node-cwd script.ts

# Equivalent to ts-node --esm
ts-node-esm script.ts
```

## Shebang

To write scripts with maximum portability, [specify options in your `tsconfig.json`](./configuration#via-tsconfigjson-recommended) and omit them from the shebang.

```typescript twoslash
#!/usr/bin/env ts-node

// ts-node options are read from tsconfig.json

console.log("Hello, world!")
```

Including options within the shebang requires the [`env -S` flag](https://manpages.debian.org/bullseye/coreutils/env.1.en.html#S), which is available on recent versions of `env`. ([compatibility](https://github.com/TypeStrong/ts-node/pull/1448#issuecomment-913895766))

```typescript twoslash
#!/usr/bin/env -S ts-node --files
// This shebang works on Mac and Linux with newer versions of env
// Technically, Mac allows omitting `-S`, but Linux requires it
```

To test your version of `env` for compatibility with `-S`:

```shell
# Note that these unusual quotes are necessary
/usr/bin/env --debug '-S echo foo bar'
```

## node flags and other tools

You can register ts-node without using our CLI: `node -r ts-node/register` and `node --loader ts-node/esm`

In many cases, setting [`NODE_OPTIONS`](https://nodejs.org/api/cli.html#cli_node_options_options) will enable `ts-node` within other node tools, child processes, and worker threads.  This can be combined with other node flags.

```shell
NODE_OPTIONS="-r ts-node/register --no-warnings" node ./index.ts
```

Or, if you require native ESM support:

```shell
NODE_OPTIONS="--loader ts-node/esm"
```

This tells any node processes which receive this environment variable to install `ts-node`'s hooks before executing other code.

If you are invoking node directly, you can avoid the environment variable and pass those flags to node.

```shell
node --loader ts-node/esm --inspect ./index.ts
```

## Programmatic

You can require ts-node and register the loader for future requires by using `require('ts-node').register({ /* options */ })`.

Check out our [API](./api.md) for more features.
