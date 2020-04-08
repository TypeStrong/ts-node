# ![TypeScript Node](logo.svg?sanitize=true)

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][downloads-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]

> TypeScript execution and REPL for node.js, with source map support. **Works with `typescript@>=2.7`**.

## Installation

```sh
# Locally in your project.
npm install -D typescript
npm install -D ts-node

# Or globally with TypeScript.
npm install -g typescript
npm install -g ts-node
```

**Tip:** Installing modules locally allows you to control and share the versions through `package.json`. TS Node will always resolve the compiler from `cwd` before checking relative to its own installation.

## Usage

### Shell

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
```

![TypeScript REPL](https://github.com/TypeStrong/ts-node/raw/master/screenshot.png)

### Shebang

```typescript
#!/usr/bin/env ts-node-script
```

While `ts-node` searches for the `tsconfig.json` file in your current working directory and its ancestor directories, `ts-node-script` searches relative to the location of the script, which is passed as an argument to the command. See [below](#loading-tsconfigjson) for more information.

Please note that the [`ts-node-script`](https://github.com/TypeStrong/ts-node/blob/56f2079d1436d1f63a4976859cda57ab0a856b26/package.json#L10) and [`ts-node-transpile-only`](https://github.com/TypeStrong/ts-node/blob/56f2079d1436d1f63a4976859cda57ab0a856b26/package.json#L11) commands are included in the `ts-node` installation and invoke the main command with [`--script-mode`](https://github.com/TypeStrong/ts-node/blob/56f2079d1436d1f63a4976859cda57ab0a856b26/src/bin-script.ts#L5) respectively [`--transpile-only`](https://github.com/TypeStrong/ts-node/blob/56f2079d1436d1f63a4976859cda57ab0a856b26/src/bin-transpile.ts#L5).

Please also note that directly installing TypeScript files without precompilation into the `PATH` through the [`"bin"`](https://docs.npmjs.com/files/package.json#bin) property of `package.json` is currently not supported because `ts-node-script` does not resolve the symlink to the script's actual location. (See [this issue](https://github.com/TypeStrong/ts-node/issues/995) for more information and ways around this limitation.)

### Programmatic

You can require `ts-node` and register the loader for future requires by using `require('ts-node').register({ /* options */ })`. You can also use file shortcuts - `node -r ts-node/register` or `node -r ts-node/register/transpile-only` - depending on your preferences.

**Note:** If you need to use advanced node.js CLI arguments (e.g. `--inspect`), use them with `node -r ts-node/register` instead of the `ts-node` CLI.

#### Developers

**TS Node** exports a `create()` function that can be used to initialize a TypeScript compiler that isn't registered to `require.extensions`, and it uses the same code as `register`.

### Mocha

Mocha 6

```sh
mocha --require ts-node/register --watch-extensions ts,tsx "test/**/*.{ts,tsx}" [...args]
```

**Note:** `--watch-extensions` is only used in `--watch` mode.

Mocha 7

```sh
mocha --require ts-node/register --extensions ts,tsx --watch --watch-files src 'tests/**/*.{ts,tsx}' [...args]
```

### Tape

```sh
ts-node node_modules/tape/bin/tape [...args]
```

### Gulp

```sh
# Create a `gulpfile.ts` and run `gulp`.
gulp
```

### Visual Studio Code

Create a new node.js configuration, add `-r ts-node/register` to node args and move the `program` to the `args` list (so VS Code doesn't look for `outFiles`).

```json
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

**Note:** If you are using the `--project <tsconfig.json>` command line argument as per the [Configuration Options](#configuration-options), and want to apply this same behavior when launching in VS Code, add an "env" key into the launch configuration: `"env": { "TS_NODE_PROJECT": "<tsconfig.json>" }`.

### IntelliJ (and WebStorm)

Create a new Node.js configuration and add `-r ts-node/register` to "Node parameters."

**Note:** If you are using the `--project <tsconfig.json>` command line argument as per the [Configuration Options](#configuration-options), and want to apply this same behavior when launching in IntelliJ, specify under "Environment Variables": `TS_NODE_PROJECT=<tsconfig.json>`.

## How It Works

**TypeScript Node** works by registering the TypeScript compiler for `.tsx?` and `.jsx?` (when `allowJs == true`) extensions. When node.js has an extension registered (via `require.extensions`), it will use the extension internally for module resolution. When an extension is unknown to node.js, it handles the file as `.js` (JavaScript). By default, **TypeScript Node** avoids compiling files in `/node_modules/` for three reasons:

1. Modules should always be published in a format node.js can consume
2. Transpiling the entire dependency tree will make your project slower
3. Differing behaviours between TypeScript and node.js (e.g. ES2015 modules) can result in a project that works until you decide to support a feature natively from node.js

**P.S.** This means if you don't register an extension, it is compiled as JavaScript. When `ts-node` is used with `allowJs`, JavaScript files are transpiled using the TypeScript compiler.

## Loading `tsconfig.json`

If you do not provide an absolute or relative `--project` path, *TypeScript Node* lets the *TypeScript Compiler* locate the `tsconfig.json` file (with [this code](https://github.com/TypeStrong/ts-node/blob/56f2079d1436d1f63a4976859cda57ab0a856b26/src/index.ts#L897-L899)). According to its [documentation](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html) and [implementation](https://github.com/microsoft/TypeScript/blob/3e86f15f5101a354625427befbd907e3bac57b30/src/compiler/program.ts#L2-L7), the *TypeScript Compiler* searches for the `tsconfig.json` file starting in the current directory and continues up the parent directory chain. You can set the [working directory](https://github.com/TypeStrong/ts-node/blob/92cf9613828c2ba2fe37b7a0aa7895e122c16185/src/bin.ts#L240-L258) used for this purpose to the directory of the script for which you invoke `ts-node` with the `--script-mode` flag. If you prefer not to use any `tsconfig.json` file, use the `--skip-project` flag.

**Tip**: You can use `ts-node` together with [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) to load modules according to the `paths` section in `tsconfig.json`.

## Configuration Options

You can set options by passing them before the script path, via programmatic usage or via environment variables.

```sh
ts-node --compiler ntypescript --project src/tsconfig.json hello-world.ts
```

**Note:** [`ntypescript`](https://github.com/TypeStrong/ntypescript#readme) is an example of a TypeScript compatible `compiler`.

### CLI Options

`ts-node` supports `--print` (`-p`), `--eval` (`-e`), `--require` (`-r`) and `--interactive` (`-i`) similar to the [node.js CLI options](https://nodejs.org/api/cli.html).

* `-h, --help` Prints the help text
* `-v, --version` Prints the version
* `-s, --script-mode` Use the directory of the passed script instead of the current directory

### CLI and Programmatic Options

_The name of the environment variable and the option's default value are denoted in parentheses._

* `-T, --transpile-only` Use TypeScript's faster `transpileModule` (`TS_NODE_TRANSPILE_ONLY`, default: `false`)
* `-H, --compiler-host` Use TypeScript's compiler host API (`TS_NODE_COMPILER_HOST`, default: `false`)
* `-I, --ignore [pattern]` Override the path patterns to skip compilation (`TS_NODE_IGNORE`, default: `/node_modules/`)
* `-P, --project [path]` Path to TypeScript JSON project file (`TS_NODE_PROJECT`)
* `-C, --compiler [name]` Specify a custom TypeScript compiler (`TS_NODE_COMPILER`, default: `typescript`)
* `-D, --ignore-diagnostics [code]` Ignore TypeScript warnings by diagnostic code (`TS_NODE_IGNORE_DIAGNOSTICS`)
* `-O, --compiler-options [opts]` JSON object to merge with compiler options (`TS_NODE_COMPILER_OPTIONS`)
* `--dir` Specify working directory for config resolution (`TS_NODE_CWD`, default: `process.cwd()`)
* `--scope` Scope compiler to files within `cwd` (`TS_NODE_SCOPE`, default: `false`)
* `--files` Load `files`, `include` and `exclude` from `tsconfig.json` on startup (`TS_NODE_FILES`, default: `false`)
* `--pretty` Use pretty diagnostic formatter (`TS_NODE_PRETTY`, default: `false`)
* `--skip-project` Skip project config resolution and loading (`TS_NODE_SKIP_PROJECT`, default: `false`)
* `--skip-ignore` Skip ignore checks (`TS_NODE_SKIP_IGNORE`, default: `false`)
* `--emit` Emit output files into `.ts-node` directory (`TS_NODE_EMIT`, default: `false`)
* `--prefer-ts-exts` Re-order file extensions so that TypeScript imports are preferred (`TS_NODE_PREFER_TS_EXTS`, default: `false`)
* `--log-error` Logs TypeScript errors to stderr instead of throwing exceptions (`TS_NODE_LOG_ERROR`, default: `false`)

You can also specify some of these options inside a `"ts-node"` property in the `tsconfig.json` file. For example, if you want to transpile your TypeScript code directly to JavaScript without type checking for performance reasons, you can specify this as follows:

```json
{
  "ts-node": {
    "transpileOnly": true
  },
  "compilerOptions": {}
}
```

See [this file](https://github.com/TypeStrong/ts-node/blob/3f50313a4546e68099636baee210626bd7883115/tests/tsconfig-options/tsconfig.json) for a more elaborate example. Please note that you have to transform the options from `--kebab-case` to `camelCase`.

### Programmatic-only Options

* `transformers` `_ts.CustomTransformers | ((p: _ts.Program) => _ts.CustomTransformers)`: An object with transformers or a function that accepts a program and returns an transformers object to pass to TypeScript. Function isn't available with `transpileOnly` flag
* `readFile`: Custom TypeScript-compatible file reading function
* `fileExists`: Custom TypeScript-compatible file existence function

## SyntaxError

Any error that is not a `TSError` is from node.js (e.g. `SyntaxError`), and cannot be fixed by TypeScript or `ts-node`. These are runtime issues with your code.

### Import Statements

Current node.js stable releases do not support ES modules. Additionally, `ts-node` does not have the required hooks into node.js to support ES modules. You will need to set `"module": "commonjs"` in your `tsconfig.json` for your code to work.

## Help! My Types Are Missing!

**TypeScript Node** does _not_ use `files`, `include` or `exclude`, by default. This is because a large majority projects do not use all of the files in a project directory (e.g. `Gulpfile.ts`, runtime vs tests) and parsing every file for types slows startup time. Instead, `ts-node` starts with the script file (e.g. `ts-node index.ts`) and TypeScript resolves dependencies based on imports and references.

For global definitions, you can use the `typeRoots` compiler option.  This requires that your type definitions be structured as type packages (not loose TypeScript definition files). More details on how this works can be found in the [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/tsconfig-json.html#types-typeroots-and-types).

Example `tsconfig.json`:

```json
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

```json
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

**Tip:** If you _must_ use `files`, `include`, or `exclude`, enable `--files` flags or set `TS_NODE_FILES=true`.

## Watching and Restarting

**TypeScript Node** compiles source code via `require()`, watching files and code reloads are out of scope for the project. If you want to restart the `ts-node` process on file change, existing node.js tools such as [nodemon](https://github.com/remy/nodemon), [onchange](https://github.com/Qard/onchange) and [node-dev](https://github.com/fgnass/node-dev) work.

There's also [`ts-node-dev`](https://github.com/whitecolor/ts-node-dev), a modified version of [`node-dev`](https://github.com/fgnass/node-dev) using `ts-node` for compilation and won't restart the process on file change.

## License

MIT

[npm-image]: https://img.shields.io/npm/v/ts-node.svg?style=flat
[npm-url]: https://npmjs.org/package/ts-node
[downloads-image]: https://img.shields.io/npm/dm/ts-node.svg?style=flat
[downloads-url]: https://npmjs.org/package/ts-node
[travis-image]: https://img.shields.io/travis/TypeStrong/ts-node.svg?style=flat
[travis-url]: https://travis-ci.org/TypeStrong/ts-node
[coveralls-image]: https://img.shields.io/coveralls/TypeStrong/ts-node.svg?style=flat
[coveralls-url]: https://coveralls.io/r/TypeStrong/ts-node?branch=master
