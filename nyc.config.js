module.exports = {
  all: true,
  include: [
    'tests/node_modules/ts-node/**',
  ],
  exclude: [
    '**/*.d.ts',
    'tests/node_modules/ts-node/node_modules/**',
  ],
  excludeNodeModules: false,
  excludeAfterRemap: false
};
