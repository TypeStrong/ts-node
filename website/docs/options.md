---
title: Options
---

`ts-node` supports `--print` (`-p`), `--eval` (`-e`), `--require` (`-r`) and `--interactive` (`-i`) similar to the [node.js CLI options](https://nodejs.org/api/cli.html).

_Environment variables, where available, are in `ALL_CAPS`_

## Shell

-  `-h, --help`   Prints the help text
-  `-v, --version`   Prints the version. `-vv` prints node and typescript compiler versions, too
-  `-e, --eval`   Evaluate code
-  `-p, --print`   Print result of `--eval`
-  `-i, --interactive`   Opens the REPL even if stdin does not appear to be a terminal

## TSConfig

-  `-P, --project [path]`   Path to TypeScript JSON project file <br/>*Environment:* `TS_NODE_PROJECT`
-  `--skip-project`   Skip project config resolution and loading <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_SKIP_PROJECT`
-  `-c, --cwd-mode`   Resolve config relative to the current directory instead of the directory of the entrypoint script
-  `-O, --compiler-options [opts]`   JSON object to merge with compiler options <br/>*Environment:* `TS_NODE_COMPILER_OPTIONS`
-  `--show-config`   Print resolved `tsconfig.json`, including `ts-node` options, and exit

## Typechecking

-  `-T, --transpile-only`   Use TypeScript's faster `transpileModule` <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_TRANSPILE_ONLY`
-  `--type-check`   Opposite of `--transpile-only` <br/>*Default:* `true`<br/>*Environment:* `TS_NODE_TYPE_CHECK`
-  `-H, --compiler-host`   Use TypeScript's compiler host API <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_COMPILER_HOST`
-  `--files`   Load `files`, `include` and `exclude` from `tsconfig.json` on startup <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_FILES`
-  `-D, --ignore-diagnostics [code]`   Ignore TypeScript warnings by diagnostic code <br/>*Environment:* `TS_NODE_IGNORE_DIAGNOSTICS`

## Transpilation

-  `-I, --ignore [pattern]`   Override the path patterns to skip compilation <br/>*Default:* `/node_modules/` <br/>*Environment:* `TS_NODE_IGNORE`
-  `--skip-ignore`   Skip ignore checks <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_SKIP_IGNORE`
-  `-C, --compiler [name]`   Specify a custom TypeScript compiler <br/>*Default:* `typescript` <br/>*Environment:* `TS_NODE_COMPILER`
-  `--transpiler [name]`   Specify a third-party, non-typechecking transpiler
-  `--prefer-ts-exts`   Re-order file extensions so that TypeScript imports are preferred <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_PREFER_TS_EXTS`

## Diagnostics

-  `--log-error`   Logs TypeScript errors to stderr instead of throwing exceptions <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_LOG_ERROR`
-  `--pretty`   Use pretty diagnostic formatter <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_PRETTY`
- `TS_NODE_DEBUG` Enable debug logging<br/>

## Advanced

-  `-r, --require [path]`   Require a node module before execution
-  `--cwd`   Behave as if invoked in this working directory <br/>*Default:* `process.cwd()`<br/>*Environment:* `TS_NODE_CWD`
-  `--emit`   Emit output files into `.ts-node` directory <br/>*Default:* `false` <br/>*Environment:* `TS_NODE_EMIT`
-  `--scope`  Scope compiler to files within `scopeDir`.  Anything outside this directory is ignored. <br/>*Default: `false` <br/>*Environment:* `TS_NODE_SCOPE`
-  `--scopeDir` Directory within which compiler is limited when `scope` is enabled. <br/>*Default:* First of: `tsconfig.json` "rootDir" if specified, directory containing `tsconfig.json`, or cwd if no `tsconfig.json` is loaded.<br/>*Environment:* `TS_NODE_SCOPE_DIR`
- `TS_NODE_HISTORY` Path to history file for REPL <br/>*Default:* `~/.ts_node_repl_history`<br/>

## API

The API includes [additional options](https://typestrong.org/ts-node/api/interfaces/RegisterOptions.html) not shown here.
