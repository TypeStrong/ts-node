---
title: Performance
---

These tricks will make ts-node faster.

## Skip typechecking

It is often better to typecheck as part of your tests or linting.  You can run `tsc --noEmit` to do this.  In these cases, ts-node can skip typechecking, making it much faster.

To skip typechecking in ts-node, do one of the following:

* Enable [swc](./swc.md)
  * This is by far the fastest option
* Enable [`transpileOnly`](./options.md#transpileonly) to skip typechecking without swc

## With typechecking

If you absolutely must typecheck in ts-node:

* Avoid dynamic `require()` which may trigger repeated typechecking; prefer `import`
* Try with and without `--files`; one may be faster depending on your project
* Check `tsc --showConfig`; make sure all executed files are included
* Enable [`skipLibCheck`](https://www.typescriptlang.org/tsconfig#skipLibCheck)
* Set a [`types`](https://www.typescriptlang.org/tsconfig#types) array to avoid loading unnecessary `@types`
