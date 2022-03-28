const expect = require('expect');
const { createRequire } = require('module');

module.exports = {
  files: ['dist/test/**/*.spec.js'],
  failWithoutAssertions: false,
  environmentVariables: {
    ts_node_install_lock: `id-${Math.floor(Math.random() * 10e9)}`,
    // Force jest expect() errors to generate colorized strings, makes output more readable.
    // Delete the env var within ava processes via `require` option below.
    // This avoids passing it to spawned processes under test, which would negatively affect
    // their behavior.
    FORCE_COLOR: '3',
  },
  require: ['./src/test/remove-env-var-force-color.js'],
  timeout: '300s',
  concurrency: 1,
};

{
  /*
   * Tests *must* install and use our most recent ts-node tarball.
   * We must prevent them from accidentally require-ing a different version of
   * ts-node, from either node_modules or tests/node_modules.
   * 
   * Another possibility of interference is NODE_PATH environment variable being set,
   * and ts-node being installed globally or in any of the paths in NODE_PATH, to fix this,
   * we must remove NODE_PATH from the environment variables *BEFORE* running ava,
   * as seen in the test-spec npm script using cross-env for interop between OS'es.
   * This is not a breaking change, as calling ava directly with NODE_PATH unset will also still work,
   * it is only strictly required for environments where NODE_PATH is set to folders containing ts-node.
   */

  const { existsSync } = require('fs');
  const rimraf = require('rimraf');
  const { resolve } = require('path');

  remove(resolve(__dirname, 'node_modules/ts-node'));
  remove(resolve(__dirname, 'tests/node_modules/ts-node'));

  // Prove that we did it correctly
  expect(() => {createRequire(resolve(__dirname, 'tests/foo.js')).resolve('ts-node')}).toThrow();

  function remove(p) {
    if(existsSync(p)) rimraf.sync(p, {recursive: true})
  }
}
