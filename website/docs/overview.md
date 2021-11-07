---
title: Overview
slug: /
---

ts-node is a TypeScript execution engine and REPL for Node.js.

It JIT transforms TypeScript into JavaScript, enabling you to directly execute TypeScript on Node.js without precompiling.
This is accomplished by hooking node's module loading APIs, enabling it to be used seamlessly alongside other Node.js
tools and libraries.

## Features

* Automatic sourcemaps in stack traces
* Automatic `tsconfig.json` parsing
* Automatic defaults to match your node version
* Typechecking (optional)
* REPL
* Write standalone scripts
* Native ESM loader
* Use third-party transpilers
* Use custom transformers
* Integrate with test runners, debuggers, and CLI tools
* Compatible with pre-compilation for production

![TypeScript REPL](/img/screenshot.png)
