// Should ignore paths when importing inside node_modules
const dependsOnLodash = require('depends-on-lodash');

const main = async (): Promise<void> => {
  // Pre-conditions
  const assert: any = require('assert');
  if (typeof assert.strictEqual !== 'function')
    throw new Error('Pre-condition failed: assert could not be imported');

  // Assertions
  assert.strictEqual(dependsOnLodash.proxyLodash, 'lodash'); // not our 'lodash-local'
};

main();
