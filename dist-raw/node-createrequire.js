// Extracted from https://github.com/nodejs/node/blob/ec2ffd6b9d255e19818b6949d2f7dc7ac70faee9/lib/internal/modules/cjs/loader.js
// then modified to suit our needs

const path = require('path');
const Module = require('module');

exports.createRequireFromPath = createRequireFromPath;

function createRequireFromPath(filename) {
  // Allow a directory to be passed as the filename
  const trailingSlash =
    filename.endsWith('/') || (isWindows && filename.endsWith('\\'));

  const proxyPath = trailingSlash ?
    path.join(filename, 'noop.js') :
    filename;

  const m = new Module(proxyPath);
  m.filename = proxyPath;

  m.paths = Module._nodeModulePaths(m.path);
  return makeRequireFunction(m, proxyPath);
}

// This trick is much smaller than copy-pasting from https://github.com/nodejs/node/blob/ec2ffd6b9d255e19818b6949d2f7dc7ac70faee9/lib/internal/modules/cjs/helpers.js#L32-L101
function makeRequireFunction(module, filename) {
  module._compile('module.exports = require;', filename)
  return mod.exports
}
