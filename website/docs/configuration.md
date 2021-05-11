---
title: Configuration
---

`ts-node` supports a variety of options which can be specified via `tsconfig.json`, as CLI flags, as environment variables, or programmatically.

## CLI flags

`ts-node` CLI flags must come *before* the entrypoint script. For example:

```shell
$ ts-node --project tsconfig-dev.json say-hello.ts Ronald
Hello, Ronald!
```

## Via tsconfig.json (recommended)

`ts-node` automatically finds and loads `tsconfig.json`.  Most `ts-node` options can be specified in a `"ts-node"` object using their programmatic, camelCase names. We recommend this because it works even when you cannot pass CLI flags, such as `node --require ts-node/register` and when using shebangs.

Use `--skip-project` to skip loading the `tsconfig.json`.  Use `--project` to explicitly specify the path to a `tsconfig.json`.

When searching, it is resolved using [the same search behavior as `tsc`](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html). By default, this search is performed relative to the entrypoint script. In `--cwd-mode` or if no entrypoint is specified -- for example when using the REPL -- the search is performed relative to `--cwd` / `process.cwd()`.

You can use this sample configuration as a starting point:

```json title="tsconfig.json"
{
  // This is an alias to @tsconfig/node10: https://github.com/tsconfig/bases
  "extends": "ts-node/node10/tsconfig.json",

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
  }
}
```

Our bundled [JSON schema](https://unpkg.com/browse/ts-node@latest/tsconfig.schema.json) lists all compatible options.

### @tsconfig/bases

[tsconfig/bases](https://github.com/tsconfig/bases) maintains recommended configurations for several node versions.
As a convenience, these are bundled with `ts-node`.

```json title="tsconfig.json"
{
  "extends": "ts-node/node16/tsconfig.json",

  // Or install directly with `npm i -D @tsconfig/node16`
  "extends": "@tsconfig/node16/tsconfig.json",
}
```

## Options

`ts-node` supports `--print` (`-p`), `--eval` (`-e`), `--require` (`-r`) and `--interactive` (`-i`) similar to the [node.js CLI options](https://nodejs.org/api/cli.html).

_API options with an * cannot be specified via `tsconfig.json`_

| CLI | Environment Variable | API & tsconfig.json | Description |
|-----|----------------------|---------------------|-------------|
| `-h, --help` |  |  | Prints the help text |
| `-v, --version` |  |  | Prints the version. `-vv` prints node and typescript compiler versions, too. |
| `-c, --cwd-mode` |  |  | Resolve config relative to the current directory instead of the directory of the entrypoint script. |
| `--script-mode` |  |  | Resolve config relative to the directory of the entrypoint script. This is the default behavior. |
| `-T, --transpile-only` | `TS_NODE_TRANSPILE_ONLY` | `transpileOnly` | Use TypeScript's faster `transpileModule` (default: `false`) |
| `--type-check` | `TS_NODE_TYPE_CHECK` |  | Opposite of `--transpile-only`. (default: `true`) |
| `-H, --compiler-host` | `TS_NODE_COMPILER_HOST` | `compilerHost` | Use TypeScript's compiler host API (default: `false`) |
| `-I, --ignore [pattern]` | `TS_NODE_IGNORE` | `ignore` | Override the path patterns to skip compilation (default: `/node_modules/`) |
| `-P, --project [path]` | `TS_NODE_PROJECT` | `project` | Path to TypeScript JSON project file |
| `-C, --compiler [name]` | `TS_NODE_COMPILER` | `compiler` | Specify a custom TypeScript compiler (default: `typescript`) |
| `-D, --ignore-diagnostics [code]` | `TS_NODE_IGNORE_DIAGNOSTICS` | `ignoreDiagnostics` | Ignore TypeScript warnings by diagnostic code |
| `-O, --compiler-options [opts]` | `TS_NODE_COMPILER_OPTIONS` | `compilerOptions` | JSON object to merge with compiler options |
| `--cwd` | `TS_NODE_CWD` |  | Behave as if invoked in this working directory. (default: `process.cwd()`) |
| `--files` | `TS_NODE_FILES` | `files` | Load `files`, `include` and `exclude` from `tsconfig.json` on startup (default: `false`) |
| `--pretty` | `TS_NODE_PRETTY` | `pretty` | Use pretty diagnostic formatter (default: `false`) |
| `--skip-project` | `TS_NODE_SKIP_PROJECT` | `skipProject` | Skip project config resolution and loading (default: `false`) |
| `--skip-ignore` | `TS_NODE_SKIP_IGNORE` | `skipIgnore` | Skip ignore checks (default: `false`) |
| `--emit` | `TS_NODE_EMIT` | `emit` | Emit output files into `.ts-node` directory (default: `false`) |
| `--prefer-ts-exts` | `TS_NODE_PREFER_TS_EXTS` | `preferTsExts` | Re-order file extensions so that TypeScript imports are preferred (default: `false`) |
| `--log-error` | `TS_NODE_LOG_ERROR` | `logError` | Logs TypeScript errors to stderr instead of throwing exceptions (default: `false`) |
| `--show-config` |  |  | Print resolved `tsconfig.json`, including `ts-node` options, and exit. |
| `--transpiler [name]` |  | `transpiler` | Specify a third-party, non-typechecking transpiler |
|  | `TS_NODE_DEBUG` |  | Enable debug logging. |
|  | `TS_NODE_HISTORY` |  | Path to history file for REPL. (default; `~/.ts_node_repl_history`) |
| `--scope` | `TS_NODE_SCOPE` | `scope` | Scope compiler to files within `scopeDir`.  Files outside this directory will be ignored.  (default: `false`) |
|  |  | `scopeDir` | Sets directory for `scope`.  Defaults to tsconfig `rootDir`, directory containing `tsconfig.json`, or `cwd` |
|  |  | `projectSearchDir` | Search for config file in this or parent directories. |
|  |  | `transformers`* | An object with transformers or a factory function that accepts a program and returns a transformers object to pass to TypeScript. Factory function cannot be used with `transpileOnly` flag |
|  |  | `readFile`* | Custom TypeScript-compatible file reading function |
|  |  | `fileExists`* | Custom TypeScript-compatible file existence function |

## `node` flags

[`node` flags](https://nodejs.org/api/cli.html) must be passed directly to `node`; they cannot be passed to the `ts-node` binary nor can they be specified in `tsconfig.json`

We recommend using the [`NODE_OPTIONS`](https://nodejs.org/api/cli.html#cli_node_options_options) environment variable to pass options to `node`.

```shell
NODE_OPTIONS='--trace-deprecation --abort-on-uncaught-exception' ts-node ./index.ts
```

Alternatively, you can invoke `node` directly and install `ts-node` via `--require`/`-r`

```shell
node --trace-deprecation --abort-on-uncaught-exception -r ts-node/register ./index.ts
```
