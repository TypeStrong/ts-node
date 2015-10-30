# TypeScript Node

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][downloads-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]

> TypeScript execution environment and REPL for node. **Works with `typescript@>=1.5`**.

## Installation

```sh
npm install -g ts-node

# Install a TypeScript compiler (requires `typescript` by default).
npm install -g typescript
```

## Features

![TypeScript REPL](https://github.com/TypeStrong/ts-node/raw/master/screenshot.png)

* Execute TypeScript files with node
* Interactive REPL
* Execute (and print) TypeScript through the CLI
* Uses source maps
* Loads from `tsconfig.json`

## Usage

```sh
# Execute a script as you world normally with `node`.
ts-node script.ts

# Starts the TypeScript REPL.
ts-node

# Execute code snippets with TypeScript.
ts-node -e 'console.log("Hello, world!")'

# Execute and print code snippets with TypeScript.
ts-node -p '"Hello, world!"'
```

**Mocha:**

```
mocha test.ts --require ts-node/register src/**/*.spec.ts
```

**Tape:**

```
ts-node node_modules/tape/bin/tape src/**/*.spec.ts
```

### Loading `tsconfig.json`

**Typescript Node** automatically loads `tsconfig.json` options and referenced files from the current directory using [tsconfig](https://github.com/TypeStrong/tsconfig).

### Configuration Options

You can set options by passing them in before the script.

```sh
ts-node --compiler ntypescript --project src --ignoreWarnings 2304 hello-world.ts
```

* **project** Location to resolve `tsconfig.json` from.
* **compiler** Use a custom, require-able TypeScript compiler compatible with `typescript@>=1.5.0-alpha`.
* **ignoreWarnings** Set an array of TypeScript diagnostic codes to ignore.
* **disableWarnings** Ignore all TypeScript errors.

### Programmatic Usage

```js
require('ts-node').register({ /* options */ })

// Or using the shortcut file.
require('ts-node/register')
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
