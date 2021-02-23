---
title: Integrations
---

Guides for using ts-node alongside test runners, build systems, and editors.

### Mocha

Mocha 6

```sh
mocha --require ts-node/register --watch-extensions ts,tsx "test/**/*.{ts,tsx}" [...args]
```

**Note:** `--watch-extensions` is only used in `--watch` mode.

Mocha 7

```sh
mocha --require ts-node/register --extensions ts,tsx --watch --watch-files src 'tests/**/*.{ts,tsx}' [...args]
```

### Tape

```sh
ts-node node_modules/tape/bin/tape [...args]
```

### Gulp

```sh
# Create a `gulpfile.ts` and run `gulp`.
gulp
```

### Visual Studio Code

Create a new node.js configuration, add `-r ts-node/register` to node args and move the `program` to the `args` list (so VS Code doesn't look for `outFiles`).

```json
{
    "type": "node",
    "request": "launch",
    "name": "Launch Program",
    "runtimeArgs": [
        "-r",
        "ts-node/register"
    ],
    "args": [
        "${workspaceFolder}/index.ts"
    ]
}
```

**Note:** If you are using the `--project <tsconfig.json>` command line argument as per the [Configuration Options](configuration), and want to apply this same behavior when launching in VS Code, add an "env" key into the launch configuration: `"env": { "TS_NODE_PROJECT": "<tsconfig.json>" }`.

### IntelliJ (and WebStorm)

Create a new Node.js configuration and add `-r ts-node/register` to "Node parameters."

**Note:** If you are using the `--project <tsconfig.json>` command line argument as per the [Configuration Options](configuration), and want to apply this same behavior when launching in IntelliJ, specify under "Environment Variables": `TS_NODE_PROJECT=<tsconfig.json>`.

