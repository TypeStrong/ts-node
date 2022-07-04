---
title: Watching and restarting
---

ts-node focuses on adding first-class TypeScript support to node.  Watching files and code reloads are out of scope for the project.

If you want to restart the `ts-node` process on file change, existing node.js tools such as [nodemon](https://github.com/remy/nodemon), [onchange](https://github.com/Qard/onchange) and [node-dev](https://github.com/fgnass/node-dev) work.

There's also [`ts-node-dev`](https://github.com/whitecolor/ts-node-dev), a modified version of [`node-dev`](https://github.com/fgnass/node-dev) using `ts-node` for compilation that will restart the process on file change. Note that `ts-node-dev` is incompatible with our native ESM loader.
