const expect = require('expect');
const semver = require('semver');
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
    NODE_PATH: '',
    CONCURRENT_TESTS: '4'
  },
  require: ['./src/test/remove-env-var-force-color.js'],
  nodeArguments: ['--loader', './src/test/test-loader.mjs', '--no-warnings'],
  timeout: '300s',
  concurrency: 4,
  // We do chdir -- maybe other things -- that you can't do in worker_threads.
  workerThreads: false,
};

{
  /*
   * Tests *must* install and use our most recent ts-node tarball.
   * We must prevent them from accidentally require-ing a different version of
   * ts-node, from either node_modules or tests/node_modules.
   *
   * Another possibility of interference is NODE_PATH environment variable being set,
   * and ts-node being installed in any of the paths listed on NODE_PATH, to fix this,
   * the NODE_PATH variable must be removed from the environment *BEFORE* running ava.
   * An error will be thrown when trying to run tests with NODE_PATH set to paths with ts-node installed.
   */

  const { existsSync, rmSync } = require('fs');
  const rimraf = require('rimraf');
  const { resolve } = require('path');

  remove(resolve(__dirname, 'node_modules/ts-node'));
  remove(resolve(__dirname, 'tests/node_modules/ts-node'));

  // Prove that we did it correctly
  (() => {
    let resolved;
    try {
      resolved = createRequire(resolve(__dirname, 'tests/foo.js')).resolve('ts-node');
    } catch(err) {return}

    // require.resolve() found ts-node; this should not happen.
    let errorMessage = `require.resolve('ts-node') unexpectedly resolved to ${resolved}\n`;
    // Check for NODE_PATH interference. See comments above.
    if(process.env.NODE_PATH) {
      errorMessage += `NODE_PATH environment variable is set.  This test suite does not support running with NODE_PATH.  Unset it before running the tests.`;
    }
    throw new Error(errorMessage);
  })();

  function remove(p) {
    // Avoid node deprecation warning triggered by rimraf
    if(existsSync(p)) (rmSync || rimraf.sync)(p, {recursive: true})
  }
}
