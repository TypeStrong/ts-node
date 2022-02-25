import * as assert from 'assert';

// Path is mapped
import map1foo from 'map1/foo.js';

// Path is mapped using `.jsx` extension
import map1jsx from 'map1/jsx.js';

// Path is mapped using the first candidate `mapped/2-foo` and not `mapped/2a-foo`
import map2foo from 'map2/foo.js';

// Path is mapped using the second candidate because the first `mapped/2-bar.ts`
// does not exist
import map2bar from 'map2/bar.js';

// Path is mapped using `.js` extension
import map2js from 'map2/js.js';

// Path is mapped using the more specific pattern instead of
// `mapped/2-specific/foo
import map2specific from 'map2/specific/foo.js';

// Path is mapped when using no wildcard
import mapStatic from 'static';

// Test path mapping in `.tsx` and `.js` files.
import './index-tsx.tsx';
import './index-js.js';

assert.strictEqual(map1foo, 'mapped/1-foo');
assert.strictEqual(map1jsx, 'mapped/1-jsx');
assert.strictEqual(map2foo, 'mapped/2-foo');
assert.strictEqual(map2bar, 'mapped/2a-bar');
assert.strictEqual(map2js, 'mapped/2a-js');
assert.strictEqual(map2specific, 'mapped/2-specific-foo');
assert.strictEqual(mapStatic, 'mapped/static');
