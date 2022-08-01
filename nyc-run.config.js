module.exports = {
  all: true,
  include: ['tests/node_modules/ts-node/**'],
  exclude: ['**/*.d.ts', 'tests/node_modules/ts-node/node_modules/**'],
  extension: [],
  instrument: false,
  'hook-require': false,
  'hook-run-in-context': false,
  'hook-run-in-this-context': false,
  excludeNodeModules: false,
  excludeAfterRemap: false,
};
