---
title: Options
---

All command-line flags support both `--camelCase` and `--hyphen-case`.

Most options can be declared in your tsconfig.json: [Configuration via tsconfig.json](./configuration.md#via-tsconfigjson-recommended)

`ts-node` supports `--print` (`-p`), `--eval` (`-e`), `--require` (`-r`) and `--interactive` (`-i`) similar to the [node.js CLI](https://nodejs.org/api/cli.html).

`ts-node` supports `--project` and `--showConfig` similar to the [tsc CLI](https://www.typescriptlang.org/docs/handbook/compiler-options.html#compiler-options).

_Environment variables, where available, are in `ALL_CAPS`_

## CLI Options

### help

```shell
ts-node --help
```

Prints the help text

### version

```shell
ts-node -v
ts-node -vvv
```

Prints the version. `-vv` includes node and typescript compiler versions.  `-vvv` includes absolute paths to ts-node and
typescript installations.

### eval

```shell
ts-node -e <typescript code>
# Example
ts-node -e 'console.log("Hello world!")'
```

Evaluate code

### print

```shell
ts-node -p -e <typescript code>
# Example
ts-node -p -e '"Hello world!"'
```

Print result of `--eval`

### interactive

```shell
ts-node -i
```

Opens the REPL even if stdin does not appear to be a terminal

### esm

```shell
ts-node --esm
ts-node-esm
```

Bootstrap with the ESM loader, enabling full ESM support


## TSConfig Options

### project

```shell
ts-node -P <path/to/tsconfig>
ts-node --project <path/to/tsconfig>
```

Path to tsconfig file.

*Note the uppercase `-P`. This is different from `tsc`'s `-p/--project` option.*

*Environment:* `TS_NODE_PROJECT`

### skipProject

```shell
ts-node --skipProject
```

Skip project config resolution and loading

*Default:* `false` <br/>
*Environment:* `TS_NODE_SKIP_PROJECT`

### cwdMode

```shell
ts-node -c
ts-node --cwdMode
ts-node-cwd
```

Resolve config relative to the current directory instead of the directory of the entrypoint script

### compilerOptions

```shell
ts-node -O <json compilerOptions>
ts-node --compilerOptions <json compilerOptions>
```

JSON object to merge with compiler options

*Environment:* `TS_NODE_COMPILER_OPTIONS`

### showConfig

```shell
ts-node --showConfig
```

Print resolved `tsconfig.json`, including `ts-node` options, and exit

## Typechecking

### transpileOnly

```shell
ts-node -T
ts-node --transpileOnly
```

Use TypeScript's faster `transpileModule`

*Default:* `false`<br/>
*Environment:* `TS_NODE_TRANSPILE_ONLY`

### typeCheck

```shell
ts-node --typeCheck
```

Opposite of `--transpileOnly`

*Default:* `true`<br/>
*Environment:* `TS_NODE_TYPE_CHECK`

### compilerHost

```shell
ts-node -H
ts-node --compilerHost
```

Use TypeScript's compiler host API

*Default:* `false` <br/>
*Environment:* `TS_NODE_COMPILER_HOST`

### files

```shell
ts-node --files
```

Load `files`, `include` and `exclude` from `tsconfig.json` on startup.  This may
avoid certain typechecking failures.  See [Missing types](./troubleshooting.md#missing-types) for details.

*Default:* `false` <br/>
*Environment:* `TS_NODE_FILES`

### ignoreDiagnostics

```shell
ts-node -D <code,code>
ts-node --ignoreDiagnostics <code,code>
```

Ignore TypeScript warnings by diagnostic code

*Environment:* `TS_NODE_IGNORE_DIAGNOSTICS`


## Transpilation Options

### ignore

```shell
ts-node -I <regexp matching ignored files>
ts-node --ignore <regexp matching ignored files>
```

Override the path patterns to skip compilation

*Default:* `/node_modules/` <br/>
*Environment:* `TS_NODE_IGNORE`

### skipIgnore

```shell
ts-node --skipIgnore
```

Skip ignore checks

*Default:* `false` <br/>
*Environment:* `TS_NODE_SKIP_IGNORE`

### compiler

```shell
ts-node -C <name>
ts-node --compiler <name>
```

Specify a custom TypeScript compiler

*Default:* `typescript` <br/>
*Environment:* `TS_NODE_COMPILER`

### swc

```shell
ts-node --swc
```

Transpile with [swc](./swc.md).  Implies `--transpileOnly`

*Default:* `false`

### transpiler

```shell
ts-node --transpiler <name>
# Example
ts-node --transpiler ts-node/transpilers/swc
```

Use a third-party, non-typechecking transpiler

### preferTsExts

```shell
ts-node --preferTsExts
```

Re-order file extensions so that TypeScript imports are preferred

*Default:* `false` <br/>
*Environment:* `TS_NODE_PREFER_TS_EXTS`


## Diagnostic Options

### logError

```shell
ts-node --logError
```

Logs TypeScript errors to stderr instead of throwing exceptions

*Default:* `false` <br/>
*Environment:* `TS_NODE_LOG_ERROR`

### pretty

```shell
ts-node --pretty
```

Use pretty diagnostic formatter

*Default:* `false` <br/>
*Environment:* `TS_NODE_PRETTY`

### TS_NODE_DEBUG

```shell
TS_NODE_DEBUG=true ts-node
```

Enable debug logging

## Advanced Options

### require

```shell
ts-node -r <module name or path>
ts-node --require <module name or path>
```

Require a node module before execution

### cwd

```shell
ts-node --cwd <path/to/directory>
```

Behave as if invoked in this working directory

*Default:* `process.cwd()`<br/>
*Environment:* `TS_NODE_CWD`

### emit

```shell
ts-node --emit
```

Emit output files into `.ts-node` directory. Requires `--compilerHost`

*Default:* `false` <br/>
*Environment:* `TS_NODE_EMIT`

### scope

```shell
ts-node --scope
```

Scope compiler to files within `scopeDir`.  Anything outside this directory is ignored.

*Default:* `false` <br/>
*Environment:* `TS_NODE_SCOPE`

### scopeDir

```shell
ts-node --scopeDir <path/to/directory>
```

Directory within which compiler is limited when `scope` is enabled.

*Default:* First of: `tsconfig.json` "rootDir" if specified, directory containing `tsconfig.json`, or cwd if no `tsconfig.json` is loaded.<br/>
*Environment:* `TS_NODE_SCOPE_DIR`

### moduleTypes

Override the module type of certain files, ignoring the `package.json` `"type"` field.  See [Module type overrides](./module-type-overrides.md) for details.

*Default:* obeys `package.json` `"type"` and `tsconfig.json` `"module"` <br/>
*Can only be specified via `tsconfig.json` or API.*

### TS_NODE_HISTORY

```shell
TS_NODE_HISTORY=<path/to/history/file> ts-node
```

Path to history file for REPL

*Default:* `~/.ts_node_repl_history`

### noExperimentalReplAwait

```shell
ts-node --noExperimentalReplAwait
```

Disable top-level await in REPL.  Equivalent to node's [`--no-experimental-repl-await`](https://nodejs.org/api/cli.html#cli_no_experimental_repl_await)

*Default:* Enabled if TypeScript version is 3.8 or higher and target is ES2018 or higher.<br/>
*Environment:* `TS_NODE_EXPERIMENTAL_REPL_AWAIT` set `false` to disable

### experimentalResolver

Enable experimental hooks that re-map imports and require calls to support:

* remapping extensions, e.g. so that `import "./foo.js"` will execute `foo.ts`. Currently the following extensions will be mapped:
  * `.js` to `.ts`, `.tsx`, or `.jsx`
  * `.cjs` to `.cts`
  * `.mjs` to `.mts`
  * `.jsx` to `.tsx`
* including file extensions in CommonJS, for consistency with ESM where this is often mandatory

In the future, this hook will also support:

* `baseUrl`, `paths`
* `rootDirs`
* `outDir` to `rootDir` mappings for composite projects and monorepos

For details, see [#1514](https://github.com/TypeStrong/ts-node/issues/1514).

*Default:* `false`, but will likely be enabled by default in a future version<br/>
*Can only be specified via `tsconfig.json` or API.*

### experimentalSpecifierResolution

```shell
ts-node --experimentalSpecifierResolution node
```

Like node's [`--experimental-specifier-resolution`](https://nodejs.org/dist/latest-v18.x/docs/api/esm.html#customizing-esm-specifier-resolution-algorithm), but can also be set in your `tsconfig.json` for convenience.
Requires [`esm`](#esm) to be enabled.

*Default:* `explicit`<br/>

## API Options

The API includes [additional options](https://typestrong.org/ts-node/api/interfaces/RegisterOptions.html) not shown here.
