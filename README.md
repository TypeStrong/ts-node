# ![TypeScript Node](logo.svg?sanitize=true)

[![NPM version](https://img.shields.io/npm/v/ts-node.svg?style=flat)](https://npmjs.org/package/ts-node)
[![NPM downloads](https://img.shields.io/npm/dm/ts-node.svg?style=flat)](https://npmjs.org/package/ts-node)
[![Build status](https://img.shields.io/github/workflow/status/TypeStrong/ts-node/Continuous%20Integration)](https://github.com/TypeStrong/ts-node/actions?query=workflow%3A%22Continuous+Integration%22)
[![Test coverage](https://codecov.io/gh/TypeStrong/ts-node/branch/main/graph/badge.svg)](https://codecov.io/gh/TypeStrong/ts-node)

> TypeScript execution and REPL for node.js, with source map support. **Works with `typescript@>=2.7`**.

The latest documentation can also be found on our website: <https://typestrong.org/ts-node>

*Experimental ESM support*

Native ESM support is currently experimental. For usage, limitations, and to provide feedback, see [#1007](https://github.com/TypeStrong/ts-node/issues/1007).

# Table of Contents

*   [General](#general)
    *   [Getting Started](#getting-started)
        *   [Installation](#installation)
        *   [Usage](#usage)
            *   [Shell](#shell)
            *   [Shebang](#shebang)
            *   [Programmatic](#programmatic)
                *   [Developers](#developers)
        *   [Help! My Types Are Missing!](#help-my-types-are-missing)
    *   [How It Works](#how-it-works)
        *   [Skipping `node_modules`](#skipping-node_modules)
    *   [Usage](#usage-1)
    *   [Configuration](#configuration)
        *   [Options via tsconfig.json (recommended)](#options-via-tsconfigjson-recommended)
            *   [Finding `tsconfig.json`](#finding-tsconfigjson)
        *   [CLI Options](#cli-options)
        *   [CLI and Programmatic Options](#cli-and-programmatic-options)
        *   [Programmatic-only Options](#programmatic-only-options)
        *   [`node` flags](#node-flags)
    *   [Imports: CommonJS vs native modules](#imports-commonjs-vs-native-modules)
        *   [CommonJS (recommended)](#commonjs-recommended)
        *   [Native ECMAScript modules](#native-ecmascript-modules)
    *   [Shebang](#shebang-1)
    *   [Troubleshooting Errors](#troubleshooting-errors)
        *   [`TSError`](#tserror)
        *   [`SyntaxError`](#syntaxerror)
            *   [Unsupported JavaScript syntax](#unsupported-javascript-syntax)
*   [Advanced](#advanced)
*   [Recipes](#recipes)
    *   [Watching and Restarting](#watching-and-restarting)
    *   [Mocha](#mocha)
        *   [Mocha 7 and newer](#mocha-7-and-newer)
        *   [Mocha <=6](#mocha-6)
    *   [Gulp](#gulp)
    *   [Visual Studio Code](#visual-studio-code)
    *   [Ava](#ava)
        *   [If you are downleveling to CommonJS (recommended)](#if-you-are-downleveling-to-commonjs-recommended)
        *   [If you are using node's native ESM support](#if-you-are-using-nodes-native-esm-support)
    *   [IntelliJ and Webstorm](#intellij-and-webstorm)
    *   [Other](#other)
*   [License](#license)

# General

## Getting Started

*This website is still under construction.  It describes the latest, unreleased changes from our `main` branch.  Until it is ready, official documentation lives in our [README](https://github.com/TypeStrong/ts-node)*

### Installation

```sh
# Locally in your project.
npm install -D typescript
npm install -D ts-node

# Or globally with TypeScript.
npm install -g typescript
npm install -g ts-node
```

**Tip:** Installing modules locally allows you to control and share the versions through `package.json`. TS Node will always resolve the compiler from `cwd` before checking relative to its own installation.

### Usage

#### Shell

```sh
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

# Equivalent to ts-node --script-mode
ts-node-script scripts.ts

# Equivalent to ts-node --transpile-only
ts-node-transpile-only scripts.ts
```

![TypeScript REPL](/img/screenshot.png)

#### Shebang

```typescript
#!/usr/bin/env ts-node-script

console.log("Hello, world!")
```

`ts-node-script` is recommended because it enables `--script-mode`, discovering `tsconfig.json` relative to the script's location instead of `process.cwd()`.  This makes scripts more portable.

Passing CLI arguments via shebang is allowed on Mac but not Linux.  For example, the following will fail on Linux:

    #!/usr/bin/env ts-node --script-mode --transpile-only --files
    // This shebang is not portable.  It only works on Mac

#### Programmatic

You can require `ts-node` and register the loader for future requires by using `require('ts-node').register({ /* options */ })`. You can also use file shortcuts - `node -r ts-node/register` or `node -r ts-node/register/transpile-only` - depending on your preferences.

**Note:** If you need to use advanced node.js CLI arguments (e.g. `--inspect`), use them with `node -r ts-node/register` instead of the `ts-node` CLI.

##### Developers

**TS Node** exports a `create()` function that can be used to initialize a TypeScript compiler that isn't registered to `require.extensions`, and it uses the same code as `register`.

### Help! My Types Are Missing!

**TypeScript Node** does *not* use `files`, `include` or `exclude`, by default. This is because a large majority projects do not use all of the files in a project directory (e.g. `Gulpfile.ts`, runtime vs tests) and parsing every file for types slows startup time. Instead, `ts-node` starts with the script file (e.g. `ts-node index.ts`) and TypeScript resolves dependencies based on imports and references.

For global definitions, you can use the `typeRoots` compiler option.  This requires that your type definitions be structured as type packages (not loose TypeScript definition files). More details on how this works can be found in the [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html#types-typeroots-and-types).

Example `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "typeRoots" : ["./node_modules/@types", "./typings"]
  }
}
```

Example project structure:

```text
<project_root>/
-- tsconfig.json
-- typings/
  -- <module_name>/
    -- index.d.ts
```

Example module declaration file:

```typescript
declare module '<module_name>' {
    // module definitions go here
}
```

For module definitions, you can use [`paths`](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping):

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "custom-module-type": ["types/custom-module-type"]
    }
  }
}
```

An alternative approach for definitions of third-party libraries are [triple-slash directives](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html). This may be helpful if you prefer not to change your TypeScript `compilerOptions` or structure your custom type definitions when using `typeRoots`. Below is an example of the triple-slash directive as a relative path within your project:

```typescript
/// <reference types="./types/untyped_js_lib" />
import UntypedJsLib from "untyped_js_lib"
```

**Tip:** If you *must* use `files`, `include`, or `exclude`, enable `--files` flags or set `TS_NODE_FILES=true`.

[npm-image]: https://img.shields.io/npm/v/ts-node.svg?style=flat

[npm-url]: https://npmjs.org/package/ts-node

[downloads-image]: https://img.shields.io/npm/dm/ts-node.svg?style=flat

[downloads-url]: https://npmjs.org/package/ts-node

[github-actions-image]: https://img.shields.io/github/workflow/status/TypeStrong/ts-node/Continuous%20Integration

[github-actions-url]: https://github.com/TypeStrong/ts-node/actions?query=workflow%3A%22Continuous+Integration%22

[codecov-image]: https://codecov.io/gh/TypeStrong/ts-node/branch/main/graph/badge.svg

[codecov-url]: https://codecov.io/gh/TypeStrong/ts-node

## How It Works

`ts-node` works by registering hooks for `.ts`, `.tsx`, `.js`, and/or `.jsx` extensions.

Vanilla `node` loads `.js` by reading code from disk and executing it.  Our hooks transform code via the TypeScript compiler and pass the result to `node` for execution.  This transformation will respect your `tsconfig.json` as if you had compiled via `tsc`.

`.js` and `.jsx` are only registered when [`allowJs`](https://www.typescriptlang.org/docs/handbook/compiler-options.html#compiler-options) is enabled.

`.tsx` and `.jsx` are only registered when [`jsx`](https://www.typescriptlang.org/docs/handbook/jsx.html) is enabled.

| Extension | Requirements for transformation |
|-----------|--------------|
| `.ts`     | path not ignored (by default, `node_modules` are ignored) |
| `.tsx`    | path not ignored, [`"jsx"`](https://www.typescriptlang.org/docs/handbook/jsx.html) enabled |
| `.js`     | path not ignored, [`"allowJs"`](https://www.typescriptlang.org/docs/handbook/compiler-options.html#compiler-options) enabled |
| `.jsx`    | path not ignored, [`"allowJs"`](https://www.typescriptlang.org/docs/handbook/compiler-options.html#compiler-options) and [`"jsx"`](https://www.typescriptlang.org/docs/handbook/jsx.html) enabled |

> **Warning:** if a file is ignored or its file extension is not registered, node will either fail to resolve the file or will attempt to execute it as JavaScript without any transformation.  This may cause syntax errors or other failures, because node does not understand TypeScript type syntax nor bleeding-edge ECMAScript features.

> **Warning:** When `ts-node` is used with `allowJs`, all non-ignored JavaScript files are transformed using the TypeScript compiler.

### Skipping `node_modules`

By default, **TypeScript Node** avoids compiling files in `/node_modules/` for three reasons:

1.  Modules should always be published in a format node.js can consume
2.  Transpiling the entire dependency tree will make your project slower
3.  Differing behaviours between TypeScript and node.js (e.g. ES2015 modules) can result in a project that works until you decide to support a feature natively from node.js

## Usage

TODO verbose usage information, to supplement the quick-start in "Getting Started"

TODO split "API" into a separate file?

## Configuration

You can set options by passing them before the script path, via programmatic usage, via `tsconfig.json`, or via environment variables.

```shell
ts-node --compiler ntypescript --project src/tsconfig.json hello-world.ts
```

**Note:** [`ntypescript`](https://github.com/TypeStrong/ntypescript#readme) is an example of a TypeScript-compatible `compiler`.

### Options via tsconfig.json (recommended)

`ts-node` loads `tsconfig.json` automatically. Use this recommended configuration as a starting point.

```jsonc title="tsconfig.json"
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

#### Finding `tsconfig.json`

It is resolved relative to `--dir` using [the same search behavior as `tsc`](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html).  In `--script-mode`, this is the directory containing the script.  Otherwise it is resolved relative to `process.cwd()`, which matches the behavior of `tsc`.

Use `--project` to specify the path to your `tsconfig.json`, ignoring `--dir`.

**Tip**: You can use `ts-node` together with [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) to load modules according to the `paths` section in `tsconfig.json`.

### CLI Options

`ts-node` supports `--print` (`-p`), `--eval` (`-e`), `--require` (`-r`) and `--interactive` (`-i`) similar to the [node.js CLI options](https://nodejs.org/api/cli.html).

*   `-h, --help` Prints the help text
*   `-v, --version` Prints the version. `-vv` prints node and typescript compiler versions, too
*   `-s, --script-mode` Resolve config relative to the directory of the passed script instead of the current directory. Changes default of `--dir`

### CLI and Programmatic Options

*The name of the environment variable and the option's default value are denoted in parentheses.*

*   `-T, --transpile-only` Use TypeScript's faster `transpileModule` (`TS_NODE_TRANSPILE_ONLY`, default: `false`)
*   `-H, --compiler-host` Use TypeScript's compiler host API (`TS_NODE_COMPILER_HOST`, default: `false`)
*   `-I, --ignore [pattern]` Override the path patterns to skip compilation (`TS_NODE_IGNORE`, default: `/node_modules/`)
*   `-P, --project [path]` Path to TypeScript JSON project file (`TS_NODE_PROJECT`)
*   `-C, --compiler [name]` Specify a custom TypeScript compiler (`TS_NODE_COMPILER`, default: `typescript`)
*   `-D, --ignore-diagnostics [code]` Ignore TypeScript warnings by diagnostic code (`TS_NODE_IGNORE_DIAGNOSTICS`)
*   `-O, --compiler-options [opts]` JSON object to merge with compiler options (`TS_NODE_COMPILER_OPTIONS`)
*   `--dir` Specify working directory for config resolution (`TS_NODE_CWD`, default: `process.cwd()`, or `dirname(scriptPath)` if `--script-mode`)
*   `--scope` Scope compiler to files within `cwd` (`TS_NODE_SCOPE`, default: `false`)
*   `--files` Load `files`, `include` and `exclude` from `tsconfig.json` on startup (`TS_NODE_FILES`, default: `false`)
*   `--pretty` Use pretty diagnostic formatter (`TS_NODE_PRETTY`, default: `false`)
*   `--skip-project` Skip project config resolution and loading (`TS_NODE_SKIP_PROJECT`, default: `false`)
*   `--skip-ignore` Skip ignore checks (`TS_NODE_SKIP_IGNORE`, default: `false`)
*   `--emit` Emit output files into `.ts-node` directory (`TS_NODE_EMIT`, default: `false`)
*   `--prefer-ts-exts` Re-order file extensions so that TypeScript imports are preferred (`TS_NODE_PREFER_TS_EXTS`, default: `false`)
*   `--log-error` Logs TypeScript errors to stderr instead of throwing exceptions (`TS_NODE_LOG_ERROR`, default: `false`)

### Programmatic-only Options

*   `transformers` `_ts.CustomTransformers | ((p: _ts.Program) => _ts.CustomTransformers)`: An object with transformers or a factory function that accepts a program and returns a transformers object to pass to TypeScript. Factory function cannot be used with `transpileOnly` flag
*   `readFile`: Custom TypeScript-compatible file reading function
*   `fileExists`: Custom TypeScript-compatible file existence function

### `node` flags

[`node` flags](https://nodejs.org/api/cli.html) must be passed directly to `node`; they cannot be passed to the `ts-node` binary nor can they be specified in `tsconfig.json`

We recommend using the `NODE_OPTIONS`]\(https://nodejs.org/api/cli.html#cli_node_options_options) environment variable to pass options to `node`.

```shell
NODE_OPTIONS='--trace-deprecation --abort-on-uncaught-exception' ts-node ./index.ts
```

Alternatively, you can invoke `node` directly and install `ts-node` via `--require`/`-r`

```shell
node --trace-deprecation --abort-on-uncaught-exception -r ts-node/register ./index.ts
```

## Imports: CommonJS vs native modules

TypeScript should almost always be written using modern `import` and `export` syntax.  However, you can either downlevel it to CommonJS or use node's native ESM support.  You do not need to use node's native ECMAScript modules support to use `import` syntax.

### CommonJS (recommended)

We recommend downleveling to CommonJS.  To do this, you must set `"module": "CommonJS"` in your `tsconfig.json` or compiler options, and remove or set `"type": "commonjs"` in your `package.json`.

```jsonc title="tsconfig.json"
{
  "compilerOptions": {
    "module": "CommonJS"
  }
}
```

```jsonc title="package.json"
{
  // This can be omitted; commonjs is the default
  "type": "commonjs"
}
```

See also: https://nodejs.org/api/packages.html#packages_type

### Native ECMAScript modules

Node's native ESM loader hooks are currently experimental and so is `ts-node`'s ESM loader hook.  This means breaking changes may happen in minor and patch releases, and it is not recommended for production.

For usage, limitations, and to provide feedback, see [#1007](https://github.com/TypeStrong/ts-node/issues/1007).

## Shebang

TODO

## Troubleshooting Errors

It is important to differentiate between errors from `ts-node`, errors from the TypeScript compiler, and errors from `node`.  It is also important to understand when errors are caused by a type error in your code, a bug in your code, or a flaw in your configuration.

### `TSError`

Type errors from the compiler are thrown as a `TSError`.  These are the same as errors you get from `tsc`.

### `SyntaxError`

Any error that is not a `TSError` is from node.js (e.g. `SyntaxError`), and cannot be fixed by TypeScript or `ts-node`. These are bugs in your code or configuration.

#### Unsupported JavaScript syntax

Your version of `node` may not support all JavaScript syntax supported by TypeScript.  The compiler must transform this syntax via "downleveling," which is controlled by
the [tsconfig `"target"` option](https://www.typescriptlang.org/tsconfig#target).  Otherwise your code will compile fine, but node will throw a `SyntaxError`.

For example, `node` 12 does not understand the `?.` optional chaining operator.  If you use `"target": "esnext"`, then the following TypeScript syntax:

```typescript
const bar: string | undefined = foo?.bar;
```

will compile into this JavaScript:

```javascript
const a = foo?.bar;
```

When you try to run this code, node 12 will throw a `SyntaxError`.  To fix this, you must switch to `"target": "es2019"` or lower so TypeScript transforms `?.` into something `node` can understand.

# Advanced

# Recipes

## Watching and Restarting

**TypeScript Node** compiles source code via `require()`, watching files and code reloads are out of scope for the project. If you want to restart the `ts-node` process on file change, existing node.js tools such as [nodemon](https://github.com/remy/nodemon), [onchange](https://github.com/Qard/onchange) and [node-dev](https://github.com/fgnass/node-dev) work.

There's also [`ts-node-dev`](https://github.com/whitecolor/ts-node-dev), a modified version of [`node-dev`](https://github.com/fgnass/node-dev) using `ts-node` for compilation that will restart the process on file change.

## Mocha

### Mocha 7 and newer

```sh
mocha --require ts-node/register --extensions ts,tsx --watch --watch-files src 'tests/**/*.{ts,tsx}' [...args]
```

Or specify options via your mocha config file.

```jsonc title=".mocharc.json"
{
  // Specify "require" for CommonJS
  "require": "ts-node/register",
  // Specify "loader" for native ESM
  "loader": "ts-node/esm",
  "extensions": ["ts", "tsx"],
  "spec": [
    "tests/**/*.spec.*"
  ],
  "watch-files": [
    "src"
  ]
}
```

See also: https://mochajs.org/#configuring-mocha-nodejs

### Mocha <=6

```sh
mocha --require ts-node/register --watch-extensions ts,tsx "test/**/*.{ts,tsx}" [...args]
```

**Note:** `--watch-extensions` is only used in `--watch` mode.

## Gulp

ts-node support is built-in to gulp.

```sh
# Create a `gulpfile.ts` and run `gulp`.
gulp
```

See also: https://gulpjs.com/docs/en/getting-started/javascript-and-gulpfiles#transpilation

## Visual Studio Code

Create a new node.js configuration, add `-r ts-node/register` to node args and move the `program` to the `args` list (so VS Code doesn't look for `outFiles`).

```jsonc
{
    "type": "node",
    "request": "launch",
    "name": "Launch Program",
    "runtimeArgs": [
        "-r",
        "ts-node/register"
    ],
    "args": [
        "${workspaceFolder}/index.ts"
    ]
}
```

**Note:** If you are using the `--project <tsconfig.json>` command line argument as per the [Configuration Options](../configuration), and want to apply this same behavior when launching in VS Code, add an "env" key into the launch configuration: `"env": { "TS_NODE_PROJECT": "<tsconfig.json>" }`.

## Ava

Assuming you are configuring Ava via your `package.json`, add one of the following configurations.

### If you are downleveling to CommonJS (recommended)

Use this configuration if your `package.json` does not have `"type": "module"`.

```jsonc title"package.json"
{
  "ava": {
    "extensions": [
      "ts"
    ],
    "require": [
      "ts-node/register"
    ]
  }
}
```

### If you are using node's native ESM support

This configuration is necessary if your `package.json` has `"type": "module"`.

```jsonc title"package.json"
{
  "ava": {
    "extensions": {
      "ts": "module"
    },
    "nonSemVerExperiments": {
      "configurableModuleFormat": true
    },
    "nodeArguments": [
      "--loader=ts-node/esm"
    ]
  }
}
```

## IntelliJ and Webstorm

Create a new Node.js configuration and add `-r ts-node/register` to "Node parameters."

**Note:** If you are using the `--project <tsconfig.json>` command line argument as per the [Configuration Options](../configuration), and want to apply this same behavior when launching in IntelliJ, specify under "Environment Variables": `TS_NODE_PROJECT=<tsconfig.json>`.

## Other

In many cases, setting the following environment variable may enable `ts-node` within other node tools.

```shell
NODE_OPTIONS="-r ts-node/register"
```

Or, if you require native ESM support:

```shell
NODE_OPTIONS="--loader ts-node/esm"
```

This tells any node processes which receive this environment variable to install `ts-node`'s hooks before executing other code.

See also: https://nodejs.org/api/cli.html#cli_node_options_options

# License

[MIT](https://github.com/TypeStrong/ts-node/blob/main/LICENSE)

ts-node includes source code from Node.js which is licensed under the MIT license.  [Node.js license information](https://raw.githubusercontent.com/nodejs/node/master/LICENSE)

ts-node includes source code from the TypeScript compiler which is licensed under the Apache License 2.0.  [TypeScript license information](https://github.com/microsoft/TypeScript/blob/master/LICENSE.txt)
