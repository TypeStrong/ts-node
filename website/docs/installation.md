---
title: Installation
---

```shell
# Locally in your project.
npm install -D typescript
npm install -D ts-node

# Or globally with TypeScript.
npm install -g typescript
npm install -g ts-node

# Depending on configuration, you may also need these
npm install -D tslib @types/node
```

**Tip:** Installing modules locally allows you to control and share the versions through `package.json`. ts-node will always resolve the compiler from `cwd` before checking relative to its own installation.
