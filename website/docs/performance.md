---
title: Performance
---

These tricks will make ts-node faster.

## Skip typechecking

It is often better to use `tsc --noEmit` to typecheck as part of your tests or linting. In these cases, ts-node can skip typechecking.

* Enable [swc](./swc.md)
  * This is by far the fastest option
* Enable [`transpileOnly`](./options.md#transpileonly) to skip typechecking without swc

## With typechecking

* Avoid dynamic `require()` which may trigger repeated typechecking; prefer `import`
* Try with and without `--files`; one may be faster depending on your project
* Check `tsc --showConfig`; make sure all executed files are included
* Enable [`skipLibCheck`](https://www.typescriptlang.org/tsconfig#skipLibCheck)
* Set a [`types`](https://www.typescriptlang.org/tsconfig#types) array to avoid loading unnecessary `@types`
