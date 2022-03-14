import * as assert from 'assert';

// node_modules imports should ignore mapping
import lodash from 'some-lib';

assert.strictEqual(lodash, 'lodash');
