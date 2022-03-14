import * as assert from 'assert';

// Path is mapped
import map1foo from 'map1/foo';

// Path is mapped using `.jsx` extension
import map1jsx from 'map1/jsx';

// Path is mapped using the first candidate `mapped/2-foo` and not `mapped/2a-foo`
import map2foo from 'map2/foo';

// Path is mapped using the second candidate because the first `mapped/2-bar.ts`
// does not exist
import map2bar from 'map2/bar';

// Path is mapped using `.js` extension
import map2js from 'map2/js';

// Path is mapped using the more specific pattern instead of
// `mapped/2-specific/foo
import map2specific from 'map2/specific/foo';

// Path is mapped when using no wildcard
import mapStatic from 'static';

// Test path mapping in `.tsx` and `.js` files.
import './index-tsx.tsx';
import './index-js.js';

assert.equal(map1foo, 'mapped/1-foo');
assert.equal(map1jsx, 'mapped/1-jsx');
assert.equal(map2foo, 'mapped/2-foo');
assert.equal(map2bar, 'mapped/2a-bar');
assert.equal(map2js, 'mapped/2a-js');
assert.equal(map2specific, 'mapped/2-specific-foo');
assert.equal(mapStatic, 'mapped/static');
