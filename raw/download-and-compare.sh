# No need to ever run this script.
# It serves as helpful documentation for where these files came from.

curl https://raw.githubusercontent.com/nodejs/node/v17.0.1/lib/internal/modules/cjs/loader.js > ./node-internal-modules-cjs-loader-v17.0.1.js
diff raw/node-internal-modules-cjs-loader-v17.0.1.js dist-raw/node-internal-modules-cjs-loader.js

curl https://raw.githubusercontent.com/nodejs/node/v13.12.0/lib/internal/modules/esm/resolve.js > ./node-internal-modules-esm-resolve-v13.12.0.js
diff raw/node-internal-modules-esm-resolve-v13.12.0.js dist-raw/node-internal-modules-esm-resolve.js
