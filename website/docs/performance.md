---
title: Make it fast
---

These tricks will make ts-node faster.

## Skip typechecking

It is often better to use `tsc --noEmit` to typecheck once before your tests run or as a lint step. In these cases, ts-node can skip typechecking.

* Enable [`transpileOnly`](./options.md) to skip typechecking
* Use our [`swc` integration](./transpilers.md#swc)
  * This is by far the fastest option

## With typechecking

* Avoid dynamic `require()` which may trigger repeated typechecking; prefer `import`
* Try with and without `--files`; one may be faster depending on your project
* Check `tsc --showConfig`; make sure all executed files are included
* Enable [`skipLibCheck`](https://www.typescriptlang.org/tsconfig#skipLibCheck)
* Set a [`types`](https://www.typescriptlang.org/tsconfig#types) array to avoid loading unnecessary `@types`
