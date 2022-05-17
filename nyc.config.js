module.exports = {
  all: true,
  include: ['tests/node_modules/ts-node/**'],
  exclude: ['**/*.d.ts', 'tests/node_modules/ts-node/node_modules/**'],
  // Very important that nyc does not add additional `require.extensions` hooks.
  // It affects module resolution behavior under test
  extension: ['.js'],
  excludeNodeModules: false,
  excludeAfterRemap: false,
};
