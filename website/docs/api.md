---
title: API
---

ts-node's complete API is documented here: [API Docs](https://typestrong.org/ts-node/api/)

Here are a few highlights of what you can accomplish:

- [`create()`](https://typestrong.org/ts-node/api/index.html#create) creates ts-node's compiler service without
registering any hooks.
- [`createRepl()`](https://typestrong.org/ts-node/api/index.html#createRepl) creates an instance of our REPL service, so
you can create your own TypeScript-powered REPLs.
- [`createEsmHooks()`](https://typestrong.org/ts-node/api/index.html#createEsmHooks) creates our ESM loader hooks,
suitable for composing with other loaders or augmenting with additional features.
