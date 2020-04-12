const {nodeLibrary} = require('webpack-config-prefabs');

module.exports = [
  nodeLibrary(module, {
    entry: './src/bin.ts',
    minimize: true,
    outputFilepath: 'dist/bin.js',
  }),
  nodeLibrary(module, {
    entry: './src/index.ts',
    minimize: true,
    outputFilepath: 'dist/index.js',
  }),
];
