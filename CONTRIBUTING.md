*This guide is best-effort and will be improved as necessary.*

## Features, bugfixes, and other code

We use npm scripts for building, testing, and linting.  Read the scripts to become familiar with our build process.  The big ones are:

```
npm install
npm run build
npm run test
npm run lint-fix
```

`npm prepare` is maintained so that anyone can install `ts-node` from git, which is useful for testing experimental branches and unreleased features.

Source lives in `src` and is compiled to `dist`.  Some shim files live outside of `src` so that they can be imported at
certain paths.  For example, to allow users to import `ts-node/register`, we have `register/index.js` which is a shim to
compiled code in `dist`.

`dist-raw` is for larger chunks of code which are not compiled nor linted because they have been copy-pasted from `node`'s source code.

We publish using `np`: https://npm.im/np

## Documentation

Documentation is written in markdown in `website/docs` and rendered into a website by Docusaurus.

TODO explain how to merge into a README?  If/when this is implemented?

To edit documentation, modify the markdown files in `./website/docs` and the sidebar declaration in `./website/sidebars.js`

TODO explain branching strategy when it is finalized.
* New features are documented in `main`?
* docs fixes related to the latest stable release are documented in `docs` branch?
* Merge `docs` into `main`, then `main` into `docs`, before doing a release?

```shell
cd ./website
yarn
yarn start
# Will host live website locally
```
