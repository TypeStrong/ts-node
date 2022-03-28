// All mapped imports
import mappedJs from 'mapped/js';
import mappedJsx from 'mapped/jsx';
import mappedTs from 'mapped/ts';
import mappedTsx from 'mapped/tsx';
import foo from 'candidate/foo';
import bar from 'candidate/bar';
import fooBar from 'candidate/foo/bar';
import immobile from 'static';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(mappedTs, 'mapped-ts');
assert.strictEqual(mappedTsx, 'mapped-tsx');
assert.strictEqual(mappedJs, 'mapped-js');
assert.strictEqual(mappedJsx, 'mapped-jsx');
assert.strictEqual(foo, 'candidate-1-foo');
assert.strictEqual(bar, 'candidate-2-bar');
assert.strictEqual(fooBar, 'candidate-foo-bar');
assert.strictEqual(immobile, 'immobile');
