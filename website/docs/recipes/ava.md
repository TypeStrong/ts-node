---
title: AVA
---

Assuming you are configuring AVA via your `package.json`, add one of the following configurations.

## CommonJS

Use this configuration if your `package.json` does not have `"type": "module"`.

```json title="package.json"
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

## Native ECMAScript modules

This configuration is necessary if your `package.json` has `"type": "module"`.

```json title="package.json"
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
