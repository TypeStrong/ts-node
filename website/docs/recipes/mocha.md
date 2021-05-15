---
title: Mocha
---

## Mocha 7 and newer

```shell
mocha --require ts-node/register --extensions ts,tsx --watch --watch-files src 'tests/**/*.{ts,tsx}' [...args]
```

Or specify options via your mocha config file.

```json title=".mocharc.json"
{
  // Specify "require" for CommonJS
  "require": "ts-node/register",
  // Specify "loader" for native ESM
  "loader": "ts-node/esm",
  "extensions": ["ts", "tsx"],
  "spec": [
    "tests/**/*.spec.*"
  ],
  "watch-files": [
    "src"
  ]
}
```

See also: https://mochajs.org/#configuring-mocha-nodejs

## Mocha <=6

```shell
mocha --require ts-node/register --watch-extensions ts,tsx "test/**/*.{ts,tsx}" [...args]
```

**Note:** `--watch-extensions` is only used in `--watch` mode.
