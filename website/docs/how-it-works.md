---
title: How it works
---

ts-node works by registering hooks for `.ts`, `.tsx`, `.js`, and/or `.jsx` extensions.

Vanilla `node` loads `.js` by reading code from disk and executing it.  Our hook runs in the middle, transforming code from TypeScript to JavaScript and passing the result to `node` for execution.  This transformation will respect your `tsconfig.json` as if you had compiled via `tsc`.

We also register a few other hooks to apply sourcemaps to stack traces and remap from `.js` imports to `.ts`.
