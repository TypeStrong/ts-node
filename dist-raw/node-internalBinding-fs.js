const fs = require('fs');

// In node's core, this is implemented in C
// https://github.com/nodejs/node/blob/v15.3.0/src/node_file.cc#L891-L985
/**
 * @param {string} path
 * @returns {[] | [string, boolean]}
 */
function internalModuleReadJSON(path) {
  let string
  try {
    string = fs.readFileSync(path, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return []
    throw e
  }
  // Node's implementation checks for the presence of relevant keys: main, name, type, exports, imports
  // Node does this for performance to skip unnecessary parsing.
  // This would slow us down and, based on our usage, we can skip it.
  const containsKeys = true
  return [string, containsKeys]
}

// In node's core, this is implemented in C
// https://github.com/nodejs/node/blob/63e7dc1e5c71b70c80ed9eda230991edb00811e2/src/node_file.cc#L987-L1005
/**
 * @param {string} path
 * @returns {number} 0 = file, 1 = dir, negative = error
 */
function internalModuleStat(path) {
  try {
    const stat = fs.statSync(path);
    if(stat.isFile()) return 0;
    if(stat.isDirectory()) return 1;
  } catch(e) {
    return -e.errno || -1;
  }
}

module.exports = {
  internalModuleReadJSON,
  internalModuleStat
};
