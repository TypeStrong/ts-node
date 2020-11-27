const fs = require('fs');

// In node's core, this is implemented in C
// https://github.com/nodejs/node/blob/e9f293750760d59243020d0376edf242c9a26b67/src/node_file.cc#L845-L939
function internalModuleReadJSON(path) {
  try {
    return fs.readFileSync(path, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return undefined
    throw e
  }
}

module.exports = {
  internalModuleReadJSON
};
