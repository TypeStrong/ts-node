---
title: Configuration
---

You can set options by passing them before the script path, via programmatic usage, via `tsconfig.json`, or via environment variables.

```sh
ts-node --compiler ntypescript --project src/tsconfig.json hello-world.ts
```

**Note:** [`ntypescript`](https://github.com/TypeStrong/ntypescript#readme) is an example of a TypeScript-compatible `compiler`.


## Options via tsconfig.json (recommended)

`ts-node` loads `tsconfig.json` automatically. Use this recommended configuration as a starting point.

```jsonc
// tsconfig.json
{
  "ts-node": {
    // Most ts-node options can be specified here using their programmatic, camel-case names.
    "transpileOnly": true, // It is faster to skip typechecking.  Remove if you want ts-node to do typechecking
    "files": true,
    "compilerOptions": {
      // typescript compilerOptions specified here will override those declared below, but *only* in ts-node
    }
  },

  "compilerOptions": {
    // Copied from @tsconfig/node10: https://github.com/tsconfig/bases/blob/master/bases/node10.json
    "lib": ["es2018"],
    "module": "commonjs",
    "target": "es2018",

    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Use `--skip-project` to skip loading the `tsconfig.json`.

Our bundled [JSON schema](https://unpkg.com/browse/ts-node@latest/tsconfig.schema.json) lists all compatible options.

### Finding `tsconfig.json`

It is resolved relative to `--dir` using [the same search behavior as `tsc`](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html).  In `--script-mode`, this is the directory containing the script.  Otherwise it is resolved relative to `process.cwd()`, which matches the behavior of `tsc`.

Use `--project` to specify the path to your `tsconfig.json`, ignoring `--dir`.

**Tip**: You can use `ts-node` together with [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) to load modules according to the `paths` section in `tsconfig.json`.

## CLI Options

`ts-node` supports `--print` (`-p`), `--eval` (`-e`), `--require` (`-r`) and `--interactive` (`-i`) similar to the [node.js CLI options](https://nodejs.org/api/cli.html).

* `-h, --help` Prints the help text
* `-v, --version` Prints the version. `-vv` prints node and typescript compiler versions, too
* `-s, --script-mode` Resolve config relative to the directory of the passed script instead of the current directory. Changes default of `--dir`

## CLI and Programmatic Options

_The name of the environment variable and the option's default value are denoted in parentheses._

* `-T, --transpile-only` Use TypeScript's faster `transpileModule` (`TS_NODE_TRANSPILE_ONLY`, default: `false`)
* `-H, --compiler-host` Use TypeScript's compiler host API (`TS_NODE_COMPILER_HOST`, default: `false`)
* `-I, --ignore [pattern]` Override the path patterns to skip compilation (`TS_NODE_IGNORE`, default: `/node_modules/`)
* `-P, --project [path]` Path to TypeScript JSON project file (`TS_NODE_PROJECT`)
* `-C, --compiler [name]` Specify a custom TypeScript compiler (`TS_NODE_COMPILER`, default: `typescript`)
* `-D, --ignore-diagnostics [code]` Ignore TypeScript warnings by diagnostic code (`TS_NODE_IGNORE_DIAGNOSTICS`)
* `-O, --compiler-options [opts]` JSON object to merge with compiler options (`TS_NODE_COMPILER_OPTIONS`)
* `--dir` Specify working directory for config resolution (`TS_NODE_CWD`, default: `process.cwd()`, or `dirname(scriptPath)` if `--script-mode`)
* `--scope` Scope compiler to files within `cwd` (`TS_NODE_SCOPE`, default: `false`)
* `--files` Load `files`, `include` and `exclude` from `tsconfig.json` on startup (`TS_NODE_FILES`, default: `false`)
* `--pretty` Use pretty diagnostic formatter (`TS_NODE_PRETTY`, default: `false`)
* `--skip-project` Skip project config resolution and loading (`TS_NODE_SKIP_PROJECT`, default: `false`)
* `--skip-ignore` Skip ignore checks (`TS_NODE_SKIP_IGNORE`, default: `false`)
* `--emit` Emit output files into `.ts-node` directory (`TS_NODE_EMIT`, default: `false`)
* `--prefer-ts-exts` Re-order file extensions so that TypeScript imports are preferred (`TS_NODE_PREFER_TS_EXTS`, default: `false`)
* `--log-error` Logs TypeScript errors to stderr instead of throwing exceptions (`TS_NODE_LOG_ERROR`, default: `false`)

## Programmatic-only Options

* `transformers` `_ts.CustomTransformers | ((p: _ts.Program) => _ts.CustomTransformers)`: An object with transformers or a factory function that accepts a program and returns a transformers object to pass to TypeScript. Factory function cannot be used with `transpileOnly` flag
* `readFile`: Custom TypeScript-compatible file reading function
* `fileExists`: Custom TypeScript-compatible file existence function

## `node` flags

[`node` flags](https://nodejs.org/api/cli.html) must be passed directly to `node`; they cannot be passed to the `ts-node` binary nor can they be specified in `tsconfig.json`

We recommend using the `NODE_OPTIONS`](https://nodejs.org/api/cli.html#cli_node_options_options) environment variable to pass options to `node`.

```
NODE_OPTIONS='--trace-deprecation --abort-on-uncaught-exception' ts-node ./index.ts
```

Alternatively, you can invoke `node` directly and install `ts-node` via `--require`/`-r`

```
node --trace-deprecation --abort-on-uncaught-exception -r ts-node/register ./index.ts
```
