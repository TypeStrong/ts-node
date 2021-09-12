---
title: Other
---

In many cases, setting [`NODE_OPTIONS`](https://nodejs.org/api/cli.html#cli_node_options_options) will enable `ts-node` within other node tools, child processes, and worker threads.

```shell
NODE_OPTIONS="-r ts-node/register"
```

Or, if you require native ESM support:

```shell
NODE_OPTIONS="--loader ts-node/esm"
```

This tells any node processes which receive this environment variable to install `ts-node`'s hooks before executing other code.
