export default {
  files: ['dist/test/*.spec.js'],
  failWithoutAssertions: false,
  environmentVariables: {
    ts_node_install_lock: `id-${Math.floor(Math.random() * 10e9)}`,
  },
  timeout: '300s',
};
