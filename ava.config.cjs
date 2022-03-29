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
   * and ts-node being installed in any of the paths listed on NODE_PATH, to fix this,
   * the NODE_PATH variable must be removed from the environment *BEFORE* running ava.
   * An error will be thrown when trying to run tests with NODE_PATH set to paths with ts-node installed.
   */

  const { existsSync, realpathSync } = require('fs');
  const rimraf = require('rimraf');
  const { resolve, delimiter } = require('path');

  remove(resolve(__dirname, 'node_modules/ts-node'));
  remove(resolve(__dirname, 'tests/node_modules/ts-node'));

  // Prove that we did it correctly
  let resolved;
  try {
    expect(() => { resolved = createRequire(resolve(__dirname, 'tests/foo.js')).resolve('ts-node'); }).toThrow();
  } catch (err) {
    err.message = err.message.split('\n').slice(0, -1).join('\n') + `\nts-node unexpectedly resolved to external location: ${resolved}`;

    // Check for NODE_PATH interference. See comment on line 26.
    if (process.env.NODE_PATH) {
      const NODE_PATH = process.env.NODE_PATH.split(delimiter).filter(f => f).map(f => realpathSync(resolve(__dirname, f)));
      for (const path of NODE_PATH) {
        if (resolved.includes(path)) {
          err.message += `\n! WARNING: NODE_PATH is set and contains ts-node at ${path}`;
          err.message += `\n! This can cause problems with tests. Please clear the NODE_PATH environment variable before running tests.\n`;
        }
      }
    }

    throw err;
  }

  function remove(p) {
    if (existsSync(p)) rimraf.sync(p, {recursive: true});
  }
}
