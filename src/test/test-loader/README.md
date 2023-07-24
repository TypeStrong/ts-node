An injectable --loader used by tests. It allows tests to setup and teardown
different loader behaviors in-process.

By default, it does nothing, as if we were not using a loader at all. But it
responds to specially-crafted `import`s, installing or uninstalling a loader at
runtime.

See also `ava.config.cjs`

The loader is implemented in `loader.mjs`, and functions to send it commands are
in `client.ts`.
