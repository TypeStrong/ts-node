---
title: Ignored files
---

ts-node transforms certain files and ignores others.  We refer to this mechanism as "scoping."  There are various
options to configure scoping, so that ts-node transforms only the files in your project.

> **Warning:**
>
> An ignored file can still be executed by node.js.  Ignoring a file means we do not transform it from TypeScript into JavaScript, but it does not prevent execution.
>
> If a file requires transformation but is ignored, node may either fail to resolve it or attempt to execute it as vanilla JavaScript.  This may cause syntax errors or other failures, because node does not understand TypeScript type syntax nor bleeding-edge ECMAScript features.

## File extensions

`.js` and `.jsx` are only transformed when [`allowJs`](https://www.typescriptlang.org/docs/handbook/compiler-options.html#compiler-options) is enabled.

`.tsx` and `.jsx` are only transformed when [`jsx`](https://www.typescriptlang.org/docs/handbook/jsx.html) is enabled.

> **Warning:**
>
> When ts-node is used with `allowJs`, _all_ non-ignored JavaScript files are transformed by ts-node.

## Skipping `node_modules`

By default, ts-node avoids compiling files in `/node_modules/` for three reasons:

1. Modules should always be published in a format node.js can consume
2. Transpiling the entire dependency tree will make your project slower
3. Differing behaviours between TypeScript and node.js (e.g. ES2015 modules) can result in a project that works until you decide to support a feature natively from node.js

If you need to import uncompiled TypeScript in `node_modules`, use [`--skipIgnore`](./options#skipignore) or [`TS_NODE_SKIP_IGNORE`](./options#skipignore) to bypass this restriction.

## Skipping pre-compiled TypeScript

If a compiled JavaScript file with the same name as a TypeScript file already exists, the TypeScript file will be ignored.  ts-node will import the pre-compiled JavaScript.

To force ts-node to import the TypeScript source, not the precompiled JavaScript, use [`--preferTsExts`](./options#prefertsexts).

## Scope by directory

Our [`scope`](./options.md#scope) and [`scopeDir`](./options.md#scopedir) options will limit transformation to files
within a directory.

## Ignore by regexp

Our [`ignore`](./options.md#ignore) option will ignore files matching one or more regular expressions.
