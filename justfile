# I like using `just` instead of `npm run` or `yarn`.
# If you're like me, this justfile is for you.
# If you are not, you can safely ignore this file.

set positional-arguments
export PATH := justfile_directory() + "/node_modules/.bin:" + env_var('PATH')

default: test-local

regenerate:
  #!/usr/bin/env sh
  node -e '
    const fs = require("fs");
    let acc = fs.readFileSync("justfile", "utf8").replace(/(# CUT\n)[\s\S]+/, "$1\n");
    for(const [key, value] of Object.entries(require("./package.json").scripts)) {
      acc += `${key} *ARGS:\n  ${value.replace(/(npm run |yarn )/g, "just ").replace(/ --$/, "")} "$@"\n`;
    }
    fs.writeFileSync("justfile", acc);
  '

install:
  yarn

yarn *ARGS:
  yarn "$@"

node *ARGS:
  node "$@"

# EVERYTHING BELOW THIS LINE IS AUTO-GENERATED FROM PACKAGE.JSON
# DO NOT MODIFY BY HAND

# CUT

lint *ARGS:
  dprint check "$@"
fmt *ARGS:
  dprint fmt "$@"
clean *ARGS:
  rimraf temp dist tsconfig.schema.json tsconfig.schemastore-schema.json tsconfig.tsbuildinfo tests/ts-node-packed.tgz tests/node_modules tests/tmp "$@"
rebuild *ARGS:
  just clean && just build "$@"
build *ARGS:
  just build-nopack && just build-pack && just build-manifest "$@"
build-nopack *ARGS:
  just build-tsc && just build-configSchema "$@"
build-tsc *ARGS:
  tsc -b ./tsconfig.build-dist.json "$@"
build-configSchema *ARGS:
  typescript-json-schema --topRef --refs --validationKeywords allOf --out tsconfig.schema.json tsconfig.build-schema.json TsConfigSchema && node --require ./register ./scripts/create-merged-schema "$@"
build-pack *ARGS:
  node ./scripts/build-pack.js "$@"
build-manifest *ARGS:
  node ./scripts/build-manifest.mjs "$@"
test-spec *ARGS:
  ava "$@"
test-cov *ARGS:
  nyc ava "$@"
test *ARGS:
  just build && just lint && just test-cov "$@"
test-local *ARGS:
  just fmt && just build-tsc && just build-pack && just test-spec "$@"
pre-debug *ARGS:
  just build-tsc && just build-pack "$@"
coverage-report *ARGS:
  nyc report --reporter=lcov "$@"
__prepack_template__ *ARGS:
  just clean && just build-nopack "$@"
prepack *ARGS:
  rimraf temp dist tsconfig.schema.json tsconfig.schemastore-schema.json tsconfig.tsbuildinfo tests/ts-node-packed.tgz tests/node_modules tests/tmp && tsc -b ./tsconfig.build-dist.json && typescript-json-schema --topRef --refs --validationKeywords allOf --out tsconfig.schema.json tsconfig.build-schema.json TsConfigSchema && node --require ./register ./scripts/create-merged-schema "$@"
prepare *ARGS:
  workaround-broken-npm-prepack-behavior prepack "$@"
api-extractor *ARGS:
  api-extractor run --local --verbose "$@"
