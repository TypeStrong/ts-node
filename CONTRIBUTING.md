*This guide is best-effort and will be improved as necessary.*

## Dev environment

Tools I use:

- yarn 3 for package management
- volta (optional, node version management)

## Features, bugfixes, and other code

We use package.json scripts for building, testing, and linting.  Read the scripts to become familiar with our build process.  The big ones are:

```
yarn
yarn build
yarn test
yarn fmt
```

`yarn prepack` / `pnpm prepack`/ `npm prepare` are maintained so that anyone can install `ts-node` from git, which is useful for testing experimental branches and unreleased features.

Source lives in `src` and is compiled to `dist`.  Some shim files live outside of `src` so that they can be imported at
certain paths.  For example, to allow users to import `ts-node/register`, we have `register/index.js` which is a shim to
compiled code in `dist`.

`dist-raw` is for larger chunks of code which are not compiled nor linted because they have been copy-pasted from `node`'s source code.

## Tests

Test cases are declared in `src/test/*.spec.ts`, and test fixtures live in `./tests`.  They can be run with `yarn test`.

To run a subset of tests:

```
# Use ava's --match flag to match the name of a test or suite
# https://github.com/avajs/ava/blob/main/docs/05-command-line.md
# Don't forget the * wildcards
yarn test --match '*esm loader*'

# Or pass a filename as it exists in the compiled output
# To run the tests in ./src/test/diagnostics.spec.ts
yarn test ./dist/test/diagnostics.spec.js
```

Tests are run with AVA, but using a custom wrapper API to enable some TS-friendly features and grouped test suites.

The tests `yarn pack` ts-node into a tarball and `yarn install` it into `./tests/node_modules`.  This makes `./tests` a better testing environment
because it more closely matches the end-user's environment.  Complex `require()` / `import` / `--require` / `--loader` invocations behave
the way they would in a users's project.

Historically, it has been difficult to test ts-node in-process because it mutates the node environment: installing require hooks, stack trace formatters, etc.
`nyc`, `ava`, and `ts-node` all mutate the node environment, so it is tricky to setup and teardown individual tests in isolation, because ts-node's hooks need to be
reset without disturbing `nyc` or `ava` hooks.  For this reason, many tests are integration style, spawning ts-node's CLI in an external process, asking it to
execute one of the fixture projects in `./tests`.

Over time, I've gradually added setup and teardown logic so that more components can be tested in-process.

We have a debug configuration for VSCode.

1. Open a `*.spec.ts` so it is the active/focused file.
2. (optional) set breakpoints.
3. Invoke debugger with F5.

Note that some tests might misbehave in the debugger.  REPL tests in particular.  I'm not sure why, but I think it is related to how `console` does not write to
stdout when in a debug session.

### Test Context

Ava has the concept of test "context", an object which can store reusable fields common across many tests.

By convention, any functions that setup reusable context start with `ctx`, making them easier to tab-complete and auto-import while writing tests.

See `ctxTsNode` for an example.

Context setup functions are re-executed for each test case.  If you don't want this, wrap the context function in lodash `once()`.  Each test will still get a unique context object, but the values placed onto each context will be identical.

Every `ctx*` function has a namespace with `Ctx` and `T` types.  These make it easier/cleaner to write tests.

### Test Macros

Ava has the concept of test "macros", reusable functions which can declare a type of test many times with different inputs.

Macro functions are created with `test.macro()`.

By convention, if a macro function is meant to be imported and reused in multiple files, its name should start with `macro`.

Macros can also be declared to require a certain "context," thanks to the namespace types described in "Test Context" above.

See examples in `helpers/*.ts`.

## Documentation

Documentation is written in markdown in `website/docs` and rendered into a website by Docusaurus.  The README is also generated from these markdown files.

To edit documentation, modify the markdown files in `./website/docs` and the sidebar declaration in `./website/sidebars.js`

Docs for the latest stable release live in a `docs` branch.  The "Edit this page" links on the website link to the `docs`
branch so that the website can be improved in parallel with new feature work.

Docs changes for unreleased features are merged to `main` in the same PR which implements the feature, adds tests, etc.
When we release a new version, we merge `main` with `docs`, unifying the two.

```shell
cd ./website
yarn
yarn start
# Will host live website locally

yarn build-readme # will rebuild the README.md
```

This site was used to generate the favicon from a high-res PNG export of the SVG. https://realfavicongenerator.net/

## Release checklist

We publish using `np`: https://npm.im/np

1. Merge `docs` into `main` using a pull request, ensuring a consistent squash-merge
2. Rebuild the README (see instructions above, necessary because npmjs.com renders the readme)
3. (optional) Update the api-extractor report; check for unexpected changes.  See below
4. Publish with `np`
 - `np --branch main --no-tests`
  - `--no-tests` because we must rely on CI to test ts-node.  Even if you *did* run the tests locally, you would only be testing a single operating system, node version, and TypeScript version, so locally-run tests are insufficient.
5. Add changelog to the Github Release; match formatting from previous releases
6. Move `docs` branch to head of `main`
  - this rebuilds the website
  - `git push --force origin main:docs`
  - avoids merge messiness due to earlier squash-merge from `docs` to `main`
7. If tsconfig schema has changed, send a pull request to schemastore.  [Example](https://github.com/SchemaStore/schemastore/pull/1208)

## APIExtractor

`yarn api-extractor` will update an API report generated by [`api-extractor`](https://api-extractor.com/pages/overview/intro/) which may be useful
when generating release notes to detect (breaking) changes in our API surface.

I configured it for my own convenience; it is not a necessary part of our development process.
