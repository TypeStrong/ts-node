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

# Equivalent to ts-node --transpile-only
ts-node-transpile-only script.ts

# Equivalent to ts-node --cwd-mode
ts-node-cwd script.ts
```

## Shebang

```typescript
#!/usr/bin/env ts-node

console.log("Hello, world!")
```

Passing CLI arguments via shebang is allowed on Mac but not Linux.  For example, the following will fail on Linux:

```
#!/usr/bin/env ts-node --files
// This shebang is not portable.  It only works on Mac
```

Instead, specify all `ts-node` options in your `tsconfig.json`.

## Programmatic

You can require `ts-node` and register the loader for future requires by using `require('ts-node').register({ /* options */ })`. You can also use file shortcuts - `node -r ts-node/register` or `node -r ts-node/register/transpile-only` - depending on your preferences.

**Note:** If you need to use advanced node.js CLI arguments (e.g. `--inspect`), use them with `node -r ts-node/register` instead of the `ts-node` CLI.

### Developers

`ts-node` exports a `create()` function that can be used to initialize a TypeScript compiler that isn't registered to `require.extensions`, and it uses the same code as `register`.
