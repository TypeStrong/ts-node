---
title: Visual Studio Code
---

Create a new Node.js debug configuration, add `-r ts-node/register` to node args and move the `program` to the `args` list (so VS Code doesn't look for `outFiles`).

```json title=".vscode/launch.json"
{
    "configurations": [{
        "type": "node",
        "request": "launch",
        "name": "Launch Program",
        "runtimeArgs": [
            "-r",
            "ts-node/register"
        ],
        "args": [
            "${workspaceFolder}/src/index.ts"
        ]
    }],
}
```

**Note:** If you are using the `--project <tsconfig.json>` command line argument as per the [Configuration Options](../configuration.md), and want to apply this same behavior when launching in VS Code, add an "env" key into the launch configuration: `"env": { "TS_NODE_PROJECT": "<tsconfig.json>" }`.
