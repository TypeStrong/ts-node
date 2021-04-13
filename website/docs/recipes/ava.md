---
title: Ava
---

Assuming you are configuring Ava via your `package.json`, add one of the following configurations.

## If you are downleveling to CommonJS (recommended)

Use this configuration if your `package.json` does not have `"type": "module"`.

```json title"package.json"
{
  "ava": {
    "extensions": [
      "ts"
    ],
    "require": [
      "ts-node/register"
    ]
  }
}
```

## If you are using node's native ESM support

This configuration is necessary if your `package.json` has `"type": "module"`.

```json title"package.json"
{
  "ava": {
    "extensions": {
      "ts": "module"
    },
    "nonSemVerExperiments": {
      "configurableModuleFormat": true
    },
    "nodeArguments": [
      "--loader=ts-node/esm"
    ]
  }
}
```
