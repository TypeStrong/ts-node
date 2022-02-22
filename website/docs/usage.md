---
title: Usage
---

## Shell

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
```

## Shebang

```typescript
#!/usr/bin/env ts-node

console.log("Hello, world!")
```

Passing options via shebang requires the [`env -S` flag](https://manpages.debian.org/bullseye/coreutils/env.1.en.html#S), which is available on recent versions of `env`. ([compatibility](https://github.com/TypeStrong/ts-node/pull/1448#issuecomment-913895766))

```typescript
#!/usr/bin/env -S ts-node --files
// This shebang works on Mac and Linux with newer versions of env
// Technically, Mac allows omitting `-S`, but Linux requires it
```

To write scripts with maximum portability, [specify all options in your `tsconfig.json`](./configuration#via-tsconfigjson-recommended) and omit them from the shebang.

```typescript
#!/usr/bin/env ts-node
// This shebang works everywhere
```

To test your version of `env` for compatibility:

```shell
# Note that these unusual quotes are necessary
/usr/bin/env --debug '-S echo foo bar'
```

## Programmatic

You can require ts-node and register the loader for future requires by using `require('ts-node').register({ /* options */ })`. You can also use file shortcuts - `node -r ts-node/register` or `node -r ts-node/register/transpile-only` - depending on your preferences.

**Note:** If you need to use advanced node.js CLI arguments (e.g. `--inspect`), use them with `node -r ts-node/register` instead of ts-node's CLI.

### Developers

ts-node exports a `create()` function that can be used to initialize a TypeScript compiler that isn't registered to `require.extensions`, and it uses the same code as `register`.
