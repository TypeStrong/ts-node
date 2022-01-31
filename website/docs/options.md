---
title: Options
---

`ts-node` supports `--print` (`-p`), `--eval` (`-e`), `--require` (`-r`) and `--interactive` (`-i`) similar to the [node.js CLI options](https://nodejs.org/api/cli.html).

All command-line flags support both `--camelCase` and `--hyphen-case`.

_Environment variables, where available, are in `ALL_CAPS`_

## Shell

-  `-h, --help`   Prints the help text
-  `-v, --version`   Prints the version. `-vv` prints node and typescript compiler versions, too
-  `-e, --eval`   Evaluate code
-  `-p, --print`   Print result of `--eval`
-  `-i, --interactive`   Opens the REPL even if stdin does not appear to be a terminal

## TSConfig

-  `-P, --project [path]`   Path to TypeScript JSON project file <br/>*Environment:* `TS_NODE_PROJECT`
-  `--skipProject`   Skip project config resolution and loading <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_SKIP_PROJECT`
-  `-c, --cwdMode`   Resolve config relative to the current directory instead of the directory of the entrypoint script
-  `-O, --compilerOptions [opts]`   JSON object to merge with compiler options <br/>*Environment:* `TS_NODE_COMPILER_OPTIONS`
-  `--showConfig`   Print resolved `tsconfig.json`, including `ts-node` options, and exit

## Typechecking

-  `-T, --transpileOnly`   Use TypeScript's faster `transpileModule` <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_TRANSPILE_ONLY`
-  `--typeCheck`   Opposite of `--transpileOnly` <br/>*Default:* `true`<br/>*Environment:* `TS_NODE_TYPE_CHECK`
-  `-H, --compilerHost`   Use TypeScript's compiler host API <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_COMPILER_HOST`
-  `--files`   Load `files`, `include` and `exclude` from `tsconfig.json` on startup <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_FILES`
-  `-D, --ignoreDiagnostics [code]`   Ignore TypeScript warnings by diagnostic code <br/>*Environment:* `TS_NODE_IGNORE_DIAGNOSTICS`

## Transpilation

-  `-I, --ignore [pattern]`   Override the path patterns to skip compilation <br/>*Default:* `/node_modules/` <br/>*Environment:* `TS_NODE_IGNORE`
-  `--skipIgnore`   Skip ignore checks <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_SKIP_IGNORE`
-  `-C, --compiler [name]`   Specify a custom TypeScript compiler <br/>*Default:* `typescript` <br/>*Environment:* `TS_NODE_COMPILER`
-  `--swc`   Transpile with [swc](./transpilers.md#swc).  Implies `--transpileOnly` <br/>*Default:* `false`
-  `--transpiler [name]`   Specify a third-party, non-typechecking transpiler
-  `--preferTsExts`   Re-order file extensions so that TypeScript imports are preferred <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_PREFER_TS_EXTS`

## Diagnostics

-  `--logError`   Logs TypeScript errors to stderr instead of throwing exceptions <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_LOG_ERROR`
-  `--pretty`   Use pretty diagnostic formatter <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_PRETTY`
- `TS_NODE_DEBUG` Enable debug logging<br/>

## Advanced

-  `-r, --require [path]`   Require a node module before execution
-  `--cwd`   Behave as if invoked in this working directory <br/>*Default:* `process.cwd()`<br/>*Environment:* `TS_NODE_CWD`
-  `--emit`   Emit output files into `.ts-node` directory <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_EMIT`
-  `--scope`  Scope compiler to files within `scopeDir`.  Anything outside this directory is ignored. <br/>*Default: `false` <br/>*Environment:* `TS_NODE_SCOPE`
-  `--scopeDir` Directory within which compiler is limited when `scope` is enabled. <br/>*Default:* First of: `tsconfig.json` "rootDir" if specified, directory containing `tsconfig.json`, or cwd if no `tsconfig.json` is loaded.<br/>*Environment:* `TS_NODE_SCOPE_DIR`
-  `moduleType`  Override the module type of certain files, ignoring the `package.json` `"type"` field.  See [Module type overrides](./module-type-overrides.md) for details.<br/>*Default:* obeys `package.json` `"type"` and `tsconfig.json` `"module"` <br/>*Can only be specified via `tsconfig.json` or API.*
- `TS_NODE_HISTORY` Path to history file for REPL <br/>*Default:* `~/.ts_node_repl_history`<br/>
- `--noExperimentalReplAwait` Disable top-level await in REPL.  Equivalent to node's [`--no-experimental-repl-await`](https://nodejs.org/api/cli.html#cli_no_experimental_repl_await)<br/>*Default:* Enabled if TypeScript version is 3.8 or higher and target is ES2018 or higher.<br/>*Environment:* `TS_NODE_EXPERIMENTAL_REPL_AWAIT` set `false` to disable
- `experimentalResolverFeatures` Enable experimental features that re-map imports and require calls to support: `baseUrl`, `paths`, `rootDirs`, `.js` to `.ts` file extension mappings, `outDir` to `rootDir` mappings for composite projects and monorepos.  For details, see [#1514](https://github.com/TypeStrong/ts-node/issues/1514)<br/>*Default:* `false`<br/>*Can only be specified via `tsconfig.json` or API.*
- `experimentalPathMapping` Enable TypeScript path mapping in the ESM loader, CommonJS loader, or both. Today, the default is `'esm'` to map paths in the experimental ESM loader but not CommonJS.  In the next major release, the default will become `'both'`.<br/>*Default:* `'esm'`<br/>*Can only be specified via `tsconfig.json` or API.*

## API

The API includes [additional options](https://typestrong.org/ts-node/api/interfaces/RegisterOptions.html) not shown here.
