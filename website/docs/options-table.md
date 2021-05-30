---
title: Options
---

<!--
NOTE you probably want to look at `options.md` instead.

I initially wanted to render our options in a table. However, after several attempts at formatting -- all in this file -- I couldn't find one that I liked.

This page renders at a hidden URL on the website so that I can share with other contributors for feedback,
but it will likely be deleted in the future.
-->

`ts-node` supports `--print` (`-p`), `--eval` (`-e`), `--require` (`-r`) and `--interactive` (`-i`) similar to the [node.js CLI options](https://nodejs.org/api/cli.html).

<!--_Options with an * are only available in the API, not `tsconfig.json`_-->

The API includes [additional options](https://typestrong.org/ts-node/api/interfaces/RegisterOptions.html) not shown below.

_Environment variables, where available, are in `ALL_CAPS`_

<!--
| CLI | API, tsconfig, Environment Variable | Description |
|-----|---------------------|-------------|
| <nobr>`-h, --help`</nobr> |  | Prints the help text |
| <nobr>`-v, --version`</nobr> |  | Prints the version. `-vv` prints node and typescript compiler versions, too |
| <nobr>`-c, --cwd-mode`</nobr> |  | Resolve config relative to the current directory instead of the directory of the entrypoint script |
| <nobr>`--script-mode`</nobr> |  | Resolve config relative to the directory of the entrypoint script. This is the default behavior |
| <nobr>`-T, --transpile-only`</nobr> | `transpileOnly` <br/> `TS_NODE_TRANSPILE_ONLY` | Use TypeScript's faster `transpileModule` (default: `false`) |
| <nobr>`--type-check`</nobr> | `TS_NODE_TYPE_CHECK` | Opposite of `--transpile-only` (default: `true`) |
| <nobr>`-H, --compiler-host`</nobr> | `compilerHost` <br/> `TS_NODE_COMPILER_HOST` | Use TypeScript's compiler host API (default: `false`) |
| <nobr>`-I, --ignore [pattern]`</nobr> | `ignore` <br/> `TS_NODE_IGNORE` | Override the path patterns to skip compilation (default: `/node_modules/`) |
| <nobr>`-P, --project [path]`</nobr> | `project` <br/> `TS_NODE_PROJECT` | Path to TypeScript JSON project file |
| <nobr>`-C, --compiler [name]`</nobr> | `compiler` <br/> `TS_NODE_COMPILER` | Specify a custom TypeScript compiler (default: `typescript`) |
| <nobr>`--transpiler [name]`</nobr> | `transpiler` | Specify a third-party, non-typechecking transpiler |
| <nobr>`-D, --ignore-diagnostics [code]`</nobr> | `ignoreDiagnostics` <br/> `TS_NODE_IGNORE_DIAGNOSTICS` | Ignore TypeScript warnings by diagnostic code |
| <nobr>`-O, --compiler-options [opts]`</nobr> | `compilerOptions` <br/> `TS_NODE_COMPILER_OPTIONS` | JSON object to merge with compiler options |
| <nobr>`--cwd`</nobr> | `TS_NODE_CWD` | Behave as if invoked in this working directory (default: `process.cwd()`) |
| <nobr>`--files`</nobr> | `files` <br/> `TS_NODE_FILES` | Load `files`, `include` and `exclude` from `tsconfig.json` on startup (default: `false`) |
| <nobr>`--pretty`</nobr> | `pretty` <br/> `TS_NODE_PRETTY` | Use pretty diagnostic formatter (default: `false`) |
| <nobr>`--skip-project`</nobr> | `skipProject` <br/> `TS_NODE_SKIP_PROJECT` | Skip project config resolution and loading (default: `false`) |
| <nobr>`--skip-ignore`</nobr> | `skipIgnore` <br/> `TS_NODE_SKIP_IGNORE` | Skip ignore checks (default: `false`) |
| <nobr>`--emit`</nobr> | `emit` <br/> `TS_NODE_EMIT` | Emit output files into `.ts-node` directory (default: `false`) |
| <nobr>`--prefer-ts-exts`</nobr> | `preferTsExts` <br/> `TS_NODE_PREFER_TS_EXTS` | Re-order file extensions so that TypeScript imports are preferred (default: `false`) |
| <nobr>`--log-error`</nobr> | `logError` <br/> `TS_NODE_LOG_ERROR` | Logs TypeScript errors to stderr instead of throwing exceptions (default: `false`) |
| <nobr>`--show-config`</nobr> |  | Print resolved `tsconfig.json`, including `ts-node` options, and exit |
|  | `TS_NODE_DEBUG` | Enable debug logging |
|  | `TS_NODE_HISTORY` | Path to history file for REPL (default: `~/.ts_node_repl_history`) |
| <nobr>`--scope`</nobr> | `scope` <br/> `TS_NODE_SCOPE` | Scope compiler to files within `scopeDir`.  Files outside this directory will be ignored.  (default: `false`) |
|  | `scopeDir` | Sets directory for `scope`.  Defaults to tsconfig `rootDir`, directory containing `tsconfig.json`, or `cwd` |
|  | `projectSearchDir`* | Search for config file in this or parent directories |
|  | `transformers`* | An object with transformers or a factory function that accepts a program and returns a transformers object to pass to TypeScript. Factory function cannot be used with `transpileOnly` flag |
|  | `readFile`* | Custom TypeScript-compatible file reading function |
|  | `fileExists`* | Custom TypeScript-compatible file existence function |

| CLI | TSConfig, API | Description |
|-----|---------------------|-------------|
| <nobr>`-h, --help`</nobr> |  | Prints the help text |
| <nobr>`-v, --version`</nobr> |  | Prints the version. `-vv` prints node and typescript compiler versions, too |
| <nobr>`-i, --interactive`</nobr> |  | Start REPL even if stdout is not a TTY |
| <nobr>`-e, --eval`</nobr> |  | Evaluate code |
| <nobr>`-p, --print`</nobr> |  | Print result of `--eval` |
| <nobr>`-P, --project [path]`</nobr> | `project` | Path to TypeScript JSON project file <br/>*Env:* `TS_NODE_PROJECT` |
| <nobr>`--skip-project`</nobr> | `skipProject` | Skip project config resolution and loading <br/>*Default:* `false` <br/>*Env:* `TS_NODE_SKIP_PROJECT` |
| <nobr>`-c, --cwd-mode`</nobr> |  | Resolve config relative to the current directory instead of the directory of the entrypoint script |
| <nobr>`--script-mode`</nobr> |  | Resolve config relative to the directory of the entrypoint script<br/>*Default:* enabled |
| <nobr>`--show-config`</nobr> |  | Print resolved `tsconfig.json`, including `ts-node` options, and exit |
| <nobr>`-T, --transpile-only`</nobr> | `transpileOnly` | Use TypeScript's faster `transpileModule` <br/>*Default:* `false` <br/>*Env:* `TS_NODE_TRANSPILE_ONLY` |
| <nobr>`--type-check`</nobr> |  | Opposite of `--transpile-only` <br/>*Default:* `true`<br/>*Env:* `TS_NODE_TYPE_CHECK` |
| <nobr>`-H, --compiler-host`</nobr> | `compilerHost` | Use TypeScript's compiler host API <br/>*Default:* `false` <br/>*Env:* `TS_NODE_COMPILER_HOST` |
| <nobr>`-I, --ignore [pattern]`</nobr> | `ignore` | Override the path patterns to skip compilation <br/>*Default:* `/node_modules/` <br/>*Env:* `TS_NODE_IGNORE` |
| <nobr>`--skip-ignore`</nobr> | `skipIgnore` | Skip ignore checks <br/>*Default:* `false` <br/>*Env:* `TS_NODE_SKIP_IGNORE` |
| <nobr>`-C, --compiler [name]`</nobr> | `compiler` | Specify a custom TypeScript compiler <br/>*Default:* `typescript` <br/>*Env:* `TS_NODE_COMPILER` |
| <nobr>`--transpiler [name]`</nobr> | `transpiler` | Specify a third-party, non-typechecking transpiler |
| <nobr>`-D, --ignore-diagnostics [code]`</nobr> | `ignoreDiagnostics` | Ignore TypeScript warnings by diagnostic code <br/>*Env:* `TS_NODE_IGNORE_DIAGNOSTICS` |
| <nobr>`-O, --compiler-options [opts]`</nobr> | `compilerOptions` | JSON object to merge with compiler options <br/>*Env:* `TS_NODE_COMPILER_OPTIONS` |
| <nobr>`--cwd`</nobr> | | Behave as if invoked in this working directory <br/>*Default:* `process.cwd()`<br/>*Env:* `TS_NODE_CWD`  |
| <nobr>`--files`</nobr> | `files` | Load `files`, `include` and `exclude` from `tsconfig.json` on startup <br/>*Default:* `false` <br/>*Env:* `TS_NODE_FILES` |
| <nobr>`--pretty`</nobr> | `pretty` | Use pretty diagnostic formatter <br/>*Default:* `false` <br/>*Env:* `TS_NODE_PRETTY` |
| <nobr>`--emit`</nobr> | `emit` | Emit output files into `.ts-node` directory <br/>*Default:* `false` <br/>*Env:* `TS_NODE_EMIT` |
| <nobr>`--prefer-ts-exts`</nobr> | `preferTsExts` | Re-order file extensions so that TypeScript imports are preferred <br/>*Default:* `false` <br/>*Env:* `TS_NODE_PREFER_TS_EXTS` |
| <nobr>`--log-error`</nobr> | `logError` | Logs TypeScript errors to stderr instead of throwing exceptions <br/>*Default:* `false` <br/>*Env:* `TS_NODE_LOG_ERROR` |
| <nobr>`--scope`</nobr> | `scope` | Scope compiler to files within `scopeDir`.  Files outside this directory will be ignored.  <br/>*Default:* `false` <br/>*Env:* `TS_NODE_SCOPE` |
|  | `scopeDir` | Sets directory for `scope`<br/>*Default:* tsconfig `rootDir`, directory containing `tsconfig.json`, or `cwd` |
|  | `projectSearchDir` | Search for config file in this or parent directories |
|  | `transformers`* | An object with transformers or a factory function that accepts a program and returns a transformers object to pass to TypeScript. Factory function cannot be used with `transpileOnly` flag |
|  | `readFile`* | Custom TypeScript-compatible file reading function |
|  | `fileExists`* | Custom TypeScript-compatible file existence function |
|  |  | Enable debug logging<br/>*Env:* `TS_NODE_DEBUG` |
|  |  | Path to history file for REPL <br/>*Default:* `~/.ts_node_repl_history`<br/>*Env:* `TS_NODE_HISTORY` |
-->
<!--<table>
<thead><th>CLI</th><th>TSConfig, API</th><th>Description</th></thead>
<tbody>
<tr><td colspan="3"><strong>Shell</strong></td></tr>

<tr><td> <nobr><code>-h, --help</code></nobr> </td><td>  </td><td> Prints the help text </td></tr>
<tr><td> <nobr><code>-v, --version</code></nobr> </td><td>  </td><td> Prints the version. <code>-vv</code> prints node and typescript compiler versions, too </td></tr>
<tr><td> <nobr><code>-i, --interactive</code></nobr> </td><td>  </td><td> Opens the REPL even if stdin does not appear to be a terminal </td></tr>
<tr><td> <nobr><code>-e, --eval</code></nobr> </td><td>  </td><td> Evaluate code </td></tr>
<tr><td> <nobr><code>-p, --print</code></nobr> </td><td>  </td><td> Print result of <code>--eval</code> </td></tr>

<tr><td colspan="3"><strong>TSConfig</strong></td></tr>

<tr><td> <nobr><code>-P, --project [path]</code></nobr> </td><td> <code>project</code> </td><td> Path to TypeScript JSON project file <br/><em>Env:</em> <code>TS_NODE_PROJECT</code> </td></tr>
<tr><td> <nobr><code>--skip-project</code></nobr> </td><td> <code>skipProject</code> </td><td> Skip project config resolution and loading <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_SKIP_PROJECT</code> </td></tr>
<tr><td> <nobr><code>-c, --cwd-mode</code></nobr> </td><td>  </td><td> Resolve config relative to the current directory instead of the directory of the entrypoint script </td></tr>
<tr><td>  </td><td> <code>projectSearchDir</code>* </td><td> Search for config file in this or parent directories </td></tr>
<tr><td> <nobr><code>-O, --compiler-options [opts]</code></nobr> </td><td> <code>compilerOptions</code> </td><td> JSON object to merge with compiler options <br/><em>Env:</em> <code>TS_NODE_COMPILER_OPTIONS</code> </td></tr>
<tr><td> <nobr><code>--show-config</code></nobr> </td><td>  </td><td> Print resolved <code>tsconfig.json</code>, including <code>ts-node</code> options, and exit </td></tr>

<tr><td colspan="3"><strong>Typechecking</strong></td></tr>

<tr><td> <nobr><code>-T, --transpile-only</code></nobr> </td><td> <code>transpileOnly</code> </td><td> Use TypeScript's faster <code>transpileModule</code> <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_TRANSPILE_ONLY</code> </td></tr>
<tr><td> <nobr><code>--type-check</code></nobr> </td><td>  </td><td> Opposite of <code>--transpile-only</code> <br/><em>Default:</em> <code>true</code><br/><em>Env:</em> <code>TS_NODE_TYPE_CHECK</code> </td></tr>
<tr><td> <nobr><code>-H, --compiler-host</code></nobr> </td><td> <code>compilerHost</code> </td><td> Use TypeScript's compiler host API <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_COMPILER_HOST</code> </td></tr>
<tr><td> <nobr><code>--files</code></nobr> </td><td> <code>files</code> </td><td> Load <code>files</code>, <code>include</code> and <code>exclude</code> from <code>tsconfig.json</code> on startup <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_FILES</code> </td></tr>
<tr><td> <nobr><code>-D, --ignore-diagnostics [code]</code></nobr> </td><td> <code>ignoreDiagnostics</code> </td><td> Ignore TypeScript warnings by diagnostic code <br/><em>Env:</em> <code>TS_NODE_IGNORE_DIAGNOSTICS</code> </td></tr>

<tr><td colspan="3"><strong>Transpilation</strong></td></tr>

<tr><td> <nobr><code>-I, --ignore [pattern]</code></nobr> </td><td> <code>ignore</code> </td><td> Override the path patterns to skip compilation <br/><em>Default:</em> <code>/node_modules/</code> <br/><em>Env:</em> <code>TS_NODE_IGNORE</code> </td></tr>
<tr><td> <nobr><code>--skip-ignore</code></nobr> </td><td> <code>skipIgnore</code> </td><td> Skip ignore checks <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_SKIP_IGNORE</code> </td></tr>
<tr><td> <nobr><code>-C, --compiler [name]</code></nobr> </td><td> <code>compiler</code> </td><td> Specify a custom TypeScript compiler <br/><em>Default:</em> <code>typescript</code> <br/><em>Env:</em> <code>TS_NODE_COMPILER</code> </td></tr>
<tr><td> <nobr><code>--transpiler [name]</code></nobr> </td><td> <code>transpiler</code> </td><td> Specify a third-party, non-typechecking transpiler </td></tr>
<tr><td> <nobr><code>--prefer-ts-exts</code></nobr> </td><td> <code>preferTsExts</code> </td><td> Re-order file extensions so that TypeScript imports are preferred <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_PREFER_TS_EXTS</code> </td></tr>
<tr><td> <nobr><code>--scope</code></nobr> </td><td> <code>scope</code> </td><td> Scope compiler to files within <code>scopeDir</code>.  Files outside this directory will be ignored.  <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_SCOPE</code> </td></tr>
<tr><td>  </td><td> <code>scopeDir</code> </td><td> Sets directory for <code>scope</code><br/><em>Default:</em> tsconfig <code>rootDir</code>, directory containing <code>tsconfig.json</code>, or <code>cwd</code> </td></tr>

<tr><td colspan="3"><strong>Diagnostics</strong></td></tr>

<tr><td> <nobr><code>--log-error</code></nobr> </td><td> <code>logError</code> </td><td> Logs TypeScript errors to stderr instead of throwing exceptions <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_LOG_ERROR</code> </td></tr>
<tr><td> <nobr><code>--pretty</code></nobr> </td><td> <code>pretty</code> </td><td> Use pretty diagnostic formatter <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_PRETTY</code> </td></tr>
<tr><td>  </td><td>  </td><td> Enable debug logging<br/><em>Env:</em> <code>TS_NODE_DEBUG</code> </td></tr>

<tr><td colspan="3"><strong>Advanced</strong></td></tr>

<tr><td> <nobr><code>-r, --require [path]</code></nobr> </td><td> <code>require</code> </td><td> Require a node module before execution</td></tr>
<tr><td> <nobr><code>--cwd</code></nobr> </td><td> </td><td> Behave as if invoked in this working directory <br/><em>Default:</em> <code>process.cwd()</code><br/><em>Env:</em> <code>TS_NODE_CWD</code>  </td></tr>
<tr><td> <nobr><code>--emit</code></nobr> </td><td> <code>emit</code> </td><td> Emit output files into <code>.ts-node</code> directory <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_EMIT</code> </td></tr>
<tr><td>  </td><td> <code>transformers</code>* </td><td> An object with transformers or a factory function that accepts a program and returns a transformers object to pass to TypeScript. Factory function cannot be used with <code>transpileOnly</code> flag </td></tr>
<tr><td>  </td><td> <code>readFile</code>* </td><td> Custom TypeScript-compatible file reading function </td></tr>
<tr><td>  </td><td> <code>fileExists</code>* </td><td> Custom TypeScript-compatible file existence function </td></tr>
<tr><td>  </td><td>  </td><td> Path to history file for REPL <br/><em>Default:</em> <code>~/.ts_node_repl_history</code><br/><em>Env:</em> <code>TS_NODE_HISTORY</code> </td></tr>
</tbody>
</table>-->

<table>
<thead><th>CLI</th><th>TSConfig</th><th>Description</th></thead>
<tbody>
<tr><td colspan="3"><strong>Shell</strong></td></tr>

<tr><td> <nobr><code>-h, --help</code></nobr> </td><td>  </td><td> Prints the help text </td></tr>
<tr><td> <nobr><code>-v, --version</code></nobr> </td><td>  </td><td> Prints the version. <code>-vv</code> prints node and typescript compiler versions, too </td></tr>
<tr><td> <nobr><code>-e, --eval</code></nobr> </td><td>  </td><td> Evaluate code </td></tr>
<tr><td> <nobr><code>-p, --print</code></nobr> </td><td>  </td><td> Print result of <code>--eval</code> </td></tr>
<tr><td> <nobr><code>-i, --interactive</code></nobr> </td><td>  </td><td> Opens the REPL even if stdin does not appear to be a terminal </td></tr>

<tr><td colspan="3"><strong>TSConfig</strong></td></tr>

<tr><td> <nobr><code>-P, --project [path]</code></nobr> </td><td>  </td><td> Path to TypeScript JSON project file <br/><em>Env:</em> <code>TS_NODE_PROJECT</code> </td></tr>
<tr><td> <nobr><code>--skip-project</code></nobr> </td><td>  </td><td> Skip project config resolution and loading <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_SKIP_PROJECT</code> </td></tr>
<tr><td> <nobr><code>-c, --cwd-mode</code></nobr> </td><td>  </td><td> Resolve config relative to the current directory instead of the directory of the entrypoint script </td></tr>
<tr><td> <nobr><code>-O, --compiler-options [opts]</code></nobr> </td><td> <code>compilerOptions</code> </td><td> JSON object to merge with compiler options <br/><em>Env:</em> <code>TS_NODE_COMPILER_OPTIONS</code> </td></tr>
<tr><td> <nobr><code>--show-config</code></nobr> </td><td>  </td><td> Print resolved <code>tsconfig.json</code>, including <code>ts-node</code> options, and exit </td></tr>

<tr><td colspan="3"><strong>Typechecking</strong></td></tr>

<tr><td> <nobr><code>-T, --transpile-only</code></nobr> </td><td> <code>transpileOnly</code> </td><td> Use TypeScript's faster <code>transpileModule</code> <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_TRANSPILE_ONLY</code> </td></tr>
<tr><td> <nobr><code>--type-check</code></nobr> </td><td>  </td><td> Opposite of <code>--transpile-only</code> <br/><em>Default:</em> <code>true</code><br/><em>Env:</em> <code>TS_NODE_TYPE_CHECK</code> </td></tr>
<tr><td> <nobr><code>-H, --compiler-host</code></nobr> </td><td> <code>compilerHost</code> </td><td> Use TypeScript's compiler host API <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_COMPILER_HOST</code> </td></tr>
<tr><td> <nobr><code>--files</code></nobr> </td><td> <code>files</code> </td><td> Load <code>files</code>, <code>include</code> and <code>exclude</code> from <code>tsconfig.json</code> on startup <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_FILES</code> </td></tr>
<tr><td> <nobr><code>-D, --ignore-diagnostics [code]</code></nobr> </td><td> <code>ignoreDiagnostics</code> </td><td> Ignore TypeScript warnings by diagnostic code <br/><em>Env:</em> <code>TS_NODE_IGNORE_DIAGNOSTICS</code> </td></tr>

<tr><td colspan="3"><strong>Transpilation</strong></td></tr>

<tr><td> <nobr><code>-I, --ignore [pattern]</code></nobr> </td><td> <code>ignore</code> </td><td> Override the path patterns to skip compilation <br/><em>Default:</em> <code>/node_modules/</code> <br/><em>Env:</em> <code>TS_NODE_IGNORE</code> </td></tr>
<tr><td> <nobr><code>--skip-ignore</code></nobr> </td><td> <code>skipIgnore</code> </td><td> Skip ignore checks <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_SKIP_IGNORE</code> </td></tr>
<tr><td> <nobr><code>-C, --compiler [name]</code></nobr> </td><td> <code>compiler</code> </td><td> Specify a custom TypeScript compiler <br/><em>Default:</em> <code>typescript</code> <br/><em>Env:</em> <code>TS_NODE_COMPILER</code> </td></tr>
<tr><td> <nobr><code>--transpiler [name]</code></nobr> </td><td> <code>transpiler</code> </td><td> Specify a third-party, non-typechecking transpiler </td></tr>
<tr><td> <nobr><code>--prefer-ts-exts</code></nobr> </td><td> <code>preferTsExts</code> </td><td> Re-order file extensions so that TypeScript imports are preferred <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_PREFER_TS_EXTS</code> </td></tr>

<tr><td colspan="3"><strong>Diagnostics</strong></td></tr>

<tr><td> <nobr><code>--log-error</code></nobr> </td><td> <code>logError</code> </td><td> Logs TypeScript errors to stderr instead of throwing exceptions <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_LOG_ERROR</code> </td></tr>
<tr><td> <nobr><code>--pretty</code></nobr> </td><td> <code>pretty</code> </td><td> Use pretty diagnostic formatter <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_PRETTY</code> </td></tr>
<tr><td>  </td><td>  </td><td> Enable debug logging<br/><em>Env:</em> <code>TS_NODE_DEBUG</code> </td></tr>

<tr><td colspan="3"><strong>Advanced</strong></td></tr>

<tr><td> <nobr><code>-r, --require [path]</code></nobr> </td><td> <code>require</code> </td><td> Require a node module before execution</td></tr>
<tr><td> <nobr><code>--cwd</code></nobr> </td><td> </td><td> Behave as if invoked in this working directory <br/><em>Default:</em> <code>process.cwd()</code><br/><em>Env:</em> <code>TS_NODE_CWD</code>  </td></tr>
<tr><td> <nobr><code>--emit</code></nobr> </td><td> <code>emit</code> </td><td> Emit output files into <code>.ts-node</code> directory <br/><em>Default:</em> <code>false</code> <br/><em>Env:</em> <code>TS_NODE_EMIT</code> </td></tr>
<tr><td>  </td><td>  </td><td> Path to history file for REPL <br/><em>Default:</em> <code>~/.ts_node_repl_history</code><br/><em>Env:</em> <code>TS_NODE_HISTORY</code> </td></tr>
</tbody>
</table>
