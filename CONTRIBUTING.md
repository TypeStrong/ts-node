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

To edit documentation, modify the markdown files in `./website/docs` and the sidebar declaration in `./website/sidebars.js`

Docs for the latest stable release live in a `docs` branch.  The "Edit this page" links on the website link to the `docs`
branch so that the website can be improved in parallel with new feature work.

Docs changes for unreleased features are merged to `main` in the same PR which implements the feature, adds tests, etc.
When we release a new version, we merge `main` into `docs` and `docs` into `main`, unifying the two.

```shell
cd ./website
yarn
yarn start
# Will host live website locally
```

This site was used to generate the favicon from a high-res PNG export of the SVG. https://realfavicongenerator.net/
