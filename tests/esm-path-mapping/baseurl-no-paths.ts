import * as assert from 'assert';

// Import js using baseUrl
import map1foo from '1-foo.js';

// Import jsx using baseUrl and jsx extension
import map1jsx from '1-jsx.js';

assert.strictEqual(map1foo, 'mapped/1-foo');
assert.strictEqual(map1jsx, 'mapped/1-jsx');
