module.exports = {
  all: true,
  include: [
    'tests/node_modules/ts-node/**',
    // 'tests/node_modules/ts-node/dist/*.js',
    // 'tests/node_modules/ts-node/register/*.js',
    // 'tests/node_modules/ts-node/*.js',
    // 'tests/node_modules/ts-node/*.mjs',
  ],
  exclude: [
    '**/*.d.ts',
    'tests/node_modules/ts-node/node_modules/**',
  ],
  excludeNodeModules: false,
  excludeAfterRemap: false
};
