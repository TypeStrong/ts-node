TODO must require explicit rootDir; do not allow to be inferred.
TODO resolve JSON if resolveJsonModules??

Test a bunch of permutations of:

config permutations:

- allowJs
- not allowJs

- preferSrc
- not preferSrc

import permutations:

- Relative import of file
- Relative import of index
- rootless library import of main
- rootless library import of index
- rootless library import of exports sub-path
- rootless self-import of main
- rootless self-import of index
- rootless self-import of exports sub-path

  - Require with extension
  - Require without extension

  - Require from dist to dist
  - Require from dist to src
  - Require from src to dist
  - Require from src to src

lib permutations:

- module exists in both src and dist (precompilation ran)
- module exists in only dist (came from elsewhere)
- module exists only in src (did not precompile)

- .ts / .js extension
- .tsx / .js extension
- .cts / .cjs extension
- .mts / .mjs extension
- .js / .js extension
- .jsx / .js extension
- .cjs / .cjs extension
- .mjs / .mjs extension
