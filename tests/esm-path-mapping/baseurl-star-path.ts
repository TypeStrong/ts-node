import * as assert from 'assert';

// Import js using baseUrl (level-1) and star-path (level-2)
import map1foo from '1-foo.js';

// Import jsx using baseUrl (level-1), star-path (level-2), and jsx extension
import map1jsx from '1-jsx.js';

assert.strictEqual(map1foo, 'mapped/1-foo');
assert.strictEqual(map1jsx, 'mapped/1-jsx');
