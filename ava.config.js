export default {
  files: ['dist/test/**/*.spec.js'],
  failWithoutAssertions: false,
  environmentVariables: {
    ts_node_install_lock: `id-${Math.floor(Math.random() * 10e9)}`,
    // Force jest expect() errors to generate colorized strings, makes output more readable
    FORCE_COLOR: '3',
  },
  timeout: '300s',
};
