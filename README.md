# TypeScript Node

**DEPRECATED: Use [ts-node](https://www.npmjs.com/package/ts-node) instead.**

[![NPM version][npm-image]][npm-url]
[![NPM downloads][downloads-image]][downloads-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]

> TypeScript execution environment for node. **Works with `typescript@>=1.5`**.

## Installation

```sh
npm install -g typescript-node

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
mocha test.ts --require typescript-node/register src/**/*.spec.ts
```

**With Tape:**

```
ts-node tape src/**/*.spec.ts
```

### Using TypeScript With Node Programmatically

```js
require('typescript-node').register({ /* options */ })

// Or using the shortcut file.
require('typescript-node/register')
```

### Loading `tsconfig.json`

**Typescript Node** automatically loads `tsconfig.json` options and files from the current directory using [tsconfig](https://github.com/TypeStrong/tsconfig).

### Configuration Options

You can set options by passing them in before the script.

```sh
ts-node --compiler ntypescript --configFile tsconfig.json --ignoreWarnings 2304 hello-world.ts
```

* **compiler** Use a custom, require-able TypeScript compiler compatible with `typescript@>=1.5.0-alpha`
* **configFile** Manually set the location of the `tsconfig.json` file
* **ignoreWarnings** Set an array of TypeScript diagnostic codes to ignore

## License

MIT

[npm-image]: https://img.shields.io/npm/v/typescript-node.svg?style=flat
[npm-url]: https://npmjs.org/package/typescript-node
[downloads-image]: https://img.shields.io/npm/dm/typescript-node.svg?style=flat
[downloads-url]: https://npmjs.org/package/typescript-node
[travis-image]: https://img.shields.io/travis/blakeembrey/typescript-node.svg?style=flat
[travis-url]: https://travis-ci.org/blakeembrey/typescript-node
[coveralls-image]: https://img.shields.io/coveralls/blakeembrey/typescript-node.svg?style=flat
[coveralls-url]: https://coveralls.io/r/blakeembrey/typescript-node?branch=master
