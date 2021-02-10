---
title: Troubleshooting Errors
---

It is important to differentiate between errors from `ts-node`, errors from the TypeScript compiler, and errors from `node`.  It is also important to understand when errors are caused by a type error in your code, a bug in your code, or a flaw in your configuration.

## `TSError`

Type errors from the compiler are thrown as a `TSError`.  These are the same as errors you get from `tsc`.

## `SyntaxError`

Any error that is not a `TSError` is from node.js (e.g. `SyntaxError`), and cannot be fixed by TypeScript or `ts-node`. These are bugs in your code or configuration.

### Unsupported JavaScript syntax

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
