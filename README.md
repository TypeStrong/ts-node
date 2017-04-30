# TypeScript Node

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][downloads-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![Greenkeeper badge](https://badges.greenkeeper.io/TypeStrong/ts-node.svg)](https://greenkeeper.io/)

> TypeScript execution environment and REPL for node. **Works with `typescript@>=1.5`**.

## Installation

```sh
npm install -g ts-node

# Install a TypeScript compiler (requires `typescript` by default).
npm install -g typescript
```

## Features

* Execute TypeScript files with node
* Interactive REPL
* Execute (and print) TypeScript through the CLI
* Uses source maps
* Loads compiler options and `.d.ts` files from `tsconfig.json`

## Usage

```sh
# Execute a script as you would normally with `node`.
ts-node script.ts

# Starts the TypeScript REPL.
ts-node

# Execute code with TypeScript.
ts-node -e 'console.log("Hello, world!")'

# Execute, and print, code with TypeScript.
ts-node -p '"Hello, world!"'

# Pipe scripts to execute with TypeScript.
echo "console.log('Hello, world!')" | ts-node
```

![TypeScript REPL](https://github.com/TypeStrong/ts-node/raw/master/screenshot.png)

### Mocha

```sh
mocha --compilers ts:ts-node/register,tsx:ts-node/register [...args]
```

### Tape

```sh
ts-node node_modules/tape/bin/tape [...args]
```

### Gulp

```sh
# Just create a `gulpfile.ts` and run `gulp`.
gulp
```

## How It Works

**TypeScript Node** works by registering the TypeScript compiler for the `.ts`, `.tsx` and - when `allowJs` is enabled - `.js` extensions. When node.js has a file extension registered (the `require.extensions` object), it will use the extension internally with module resolution. By default, when an extension is unknown to node.js, it will fallback to handling the file as `.js` (JavaScript).

**P.S.** This means that if you don't register an extension, it'll be compiled as JavaScript. When `ts-node` is used with `allowJs`, JavaScript files are transpiled using the TypeScript compiler.

## Loading `tsconfig.json`

**Typescript Node** uses `tsconfig.json` automatically, use `-n` to skip loading `tsconfig.json`.

**NOTE**: You can use `ts-node` together with [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) to load modules according to the `paths` section in `tsconfig.json`.

## Configuration Options

You can set options by passing them in before the script.

```sh
ts-node --compiler ntypescript --project src --ignoreWarnings 2304 hello-world.ts
```

* **--project, -P** Path to resolve `tsconfig.json` from (or `false` to disable) (also `process.env.TS_NODE_PROJECT`)
* **--compiler, -C** Use a custom, require-able TypeScript compiler compatible with `typescript@>=1.5.0-alpha` (also `process.env.TS_NODE_COMPILER`)
* **--ignore** Specify an array of regular expression strings for `ts-node` to skip compiling as TypeScript (defaults to `/node_modules/`, `false` to disable) (also `process.env.TS_NODE_IGNORE`)
* **--ignoreWarnings, -I** Set an array of TypeScript diagnostic codes to ignore (also `process.env.TS_NODE_IGNORE_WARNINGS`)
* **--disableWarnings, -D** Ignore all TypeScript errors (also `process.env.TS_NODE_DISABLE_WARNINGS`)
* **--compilerOptions, -O** Set compiler options using JSON (E.g. `--compilerOptions '{"target":"es6"}'`) (also `process.env.TS_NODE_COMPILER_OPTIONS`)
* **--fast, -F** Use TypeScript's `transpileModule` mode (no type checking, but faster compilation) (also `process.env.TS_NODE_FAST`)
* **--no-cache** Skip hitting the compiled JavaScript cache (also `process.env.TS_NODE_CACHE`)
* **--cache-directory** Configure the TypeScript cache directory (also `process.env.TS_NODE_CACHE_DIRECTORY`)

## Programmatic Usage

```js
require('ts-node').register({ /* options */ })

// Or using the shortcut file.
require('ts-node/register')
```

This will register the TypeScript compiler for "on the fly" compilation support of `.ts` and `.tsx` files during the run
of the script. From here you can use `require` to bring in modules from TypeScript files:

```js
var someModule = require('path_to_a_typescript_file');
```

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
