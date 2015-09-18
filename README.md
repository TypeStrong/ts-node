# TypeScript Node

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][downloads-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]

> TypeScript execution environment for node. **Works with `typescript@>=1.5`**.

## Installation

```sh
npm install -g ts-node

# Make sure you install your TypeScript-compatible compiler.
npm install -g typescript
```

## Features

* Execute TypeScript with node
* Interactive REPL
* Execute (and print) TypeScript inline
* Supports source maps
* Supports `tsconfig.json`

## Usage

```sh
# Execute a script as you world normally with `node`.
ts-node script.ts

# Start a TypeScript REPL
ts-node

# Execute code snippets with TypeScript
ts-node -e 'console.log("Hello, world!")'

# Execute and print code snippets with TypeScript
ts-node -p '"Hello, world!"'
```

**With Mocha**

```
mocha test.ts --require ts-node/register src/**/*.spec.ts
```

**With Tape:**

```
ts-node tape src/**/*.spec.ts
```

### Using TypeScript With Node Programmatically

```js
require('ts-node').register({ /* options */ })

// Or using the shortcut file.
require('ts-node/register')
```

### Loading `tsconfig.json`

**Typescript Node** automatically loads `tsconfig.json` options and files from the current directory using [tsconfig](https://github.com/TypeStrong/tsconfig).

### Configuration Options

You can set options by passing them in before the script.

```sh
ts-node --compiler ntypescript --project src --ignoreWarnings 2304 hello-world.ts
```

* **project** Location to resolve `tsconfig.json` from.
* **compiler** Use a custom, require-able TypeScript compiler compatible with `typescript@>=1.5.0-alpha`.
* **ignoreWarnings** Set an array of TypeScript diagnostic codes to ignore.
* **disableWarnings** Ignore all TypeScript errors.

## License

MIT

[npm-image]: https://img.shields.io/npm/v/ts-node.svg?style=flat
[npm-url]: https://npmjs.org/package/ts-node
[downloads-image]: https://img.shields.io/npm/dm/ts-node.svg?style=flat
[downloads-url]: https://npmjs.org/package/ts-node
[travis-image]: https://img.shields.io/travis/blakeembrey/ts-node.svg?style=flat
[travis-url]: https://travis-ci.org/blakeembrey/ts-node
[coveralls-image]: https://img.shields.io/coveralls/blakeembrey/ts-node.svg?style=flat
[coveralls-url]: https://coveralls.io/r/blakeembrey/ts-node?branch=master
