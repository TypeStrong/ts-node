---
title: Other
---

In many cases, setting the following environment variable may enable `ts-node` within other node tools.

```shell
NODE_OPTIONS="-r ts-node/register"
```

Or, if you require native ESM support:

```shell
NODE_OPTIONS="--loader ts-node/esm"
```

This tells any node processes which receive this environment variable to install `ts-node`'s hooks before executing other code.

See also: https://nodejs.org/api/cli.html#cli_node_options_options
