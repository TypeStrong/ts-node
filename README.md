# TypeScript Node

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][downloads-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]

> TypeScript execution environment and REPL for node. **Works with `typescript@>=2.0`**.

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
* Source map support
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

### Programmatic

You can require `ts-node` and register the loader for future requires by using `require('ts-node').register({ /* options */ })`. You can also use the shortcuts `node -r ts-node/register` or `node -r ts-node/register/type-check` depending on your preferences.

**Note:** If you need to use advanced node.js CLI arguments (e.g. `--inspect`), use them with `node -r ts-node/register` instead of the `ts-node` CLI.

### Mocha

```sh
mocha --require ts-node/register --watch-extensions ts,tsx "test/**/*.{ts,tsx}" [...args]
```

**Note:** `--watch-extensions` is only used in `--watch` mode.

### Tape

```sh
ts-node node_modules/tape/bin/tape [...args]
```

### Gulp

```sh
# Create a `gulpfile.ts` and run `gulp`.
gulp
```

## How It Works

**TypeScript Node** works by registering the TypeScript compiler for the `.ts`, `.tsx` and, with `allowJs` enabled, `.js` extensions. When node.js has a file extension registered (the `require.extensions` object), it will use the extension internally for module resolution. When an extension is unknown to node.js, it will handle the file as `.js` (JavaScript).

**P.S.** This means if you don't register an extension, it is compiled as JavaScript. When `ts-node` is used with `allowJs`, JavaScript files are transpiled using the TypeScript compiler.

## Loading `tsconfig.json`

**Typescript Node** loads `tsconfig.json` automatically. Use `--skip-project` to the loading `tsconfig.json`.

**Tip**: You can use `ts-node` together with [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths) to load modules according to the `paths` section in `tsconfig.json`.

## Configuration Options

You can set options by passing them before the script path, via programmatic usage or via environment variables.

```sh
ts-node --compiler ntypescript --project src/tsconfig.json hello-world.ts
```

### CLI Options

Supports `--print`, `--eval` and `--require` from [node.js CLI options](https://nodejs.org/api/cli.html).

* `--help` Prints help text
* `--version` Prints version information

### CLI and Programmatic Options

_Environment variable denoted in parentheses._

* `--typeCheck` Enable type checking for TypeScript (`TS_NODE_TYPE_CHECK`)
* `--cacheDirectory` Configure the output file cache directory (`TS_NODE_CACHE_DIRECTORY`)
* `-I, --ignore [pattern]` Override the path patterns to skip compilation (`TS_NODE_IGNORE`)
* `-P, --project [path]` Path to TypeScript JSON project file (`TS_NODE_PROJECT`)
* `-C, --compiler [name]` Specify a custom TypeScript compiler (`TS_NODE_COMPILER`)
* `-D, --ignoreDiagnostics [code]` Ignore TypeScript warnings by diagnostic code (`TS_NODE_IGNORE_DIAGNOSTICS`)
* `-O, --compilerOptions [opts]` JSON object to merge with compiler options (`TS_NODE_COMPILER_OPTIONS`)
* `--no-cache` Disable the local TypeScript Node cache (`TS_NODE_CACHE`)
* `--skip-project` Skip project config resolution and loading (`TS_NODE_SKIP_PROJECT`)
* `--skip-ignore` Skip ignore checks (`TS_NODE_SKIP_IGNORE`)

### Programmatic Only Options

* `transformers` An array of transformers to pass to TypeScript
* `readFile` Custom TypeScript-compatible file reading function
* `fileExists` Custom TypeScript-compatible file existence function

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
