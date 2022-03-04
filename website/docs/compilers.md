---
title: Third-party compilers
---

Some projects require a patched typescript compiler which adds additional features.  For example, [`ttypescript`](https://github.com/cevek/ttypescript/tree/master/packages/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch#readme)
add the ability to configure custom transformers.  These are drop-in replacements for the vanilla `typescript` module and
implement the same API.

For example, to use `ttypescript` and `ts-transformer-keys`, add this to your `tsconfig.json`:

```json title="tsconfig.json"
{
  "ts-node": {
    // This can be omitted when using ts-patch
    "compiler": "ttypescript"
  },
  "compilerOptions": {
    // plugin configuration is the same for both ts-patch and ttypescript
    "plugins": [
      { "transform": "ts-transformer-keys/transformer" }
    ]
  }
}
```
