// Should ignore paths when importing inside node_modules
import dependsOnLodash from 'depends-on-lodash';

const main = async (): Promise<void> => {
  // Pre-conditions
  const assert: any = await import('assert');
  if (typeof assert.strictEqual !== 'function')
    throw new Error('Pre-condition failed: assert could not be imported');

  // Assertions
  assert.strictEqual(dependsOnLodash.proxyLodash, 'lodash'); // not our 'lodash-local'
};

main();
