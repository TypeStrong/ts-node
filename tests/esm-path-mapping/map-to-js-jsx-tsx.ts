// Should be able to use path to map to js, jsx, tsx
import mappedJs from 'mapped/js';
import mappedJsx from 'mapped/jsx';
import mappedTsx from 'mapped/tsx';

// Pre-conditions
import * as assert from 'assert';

// Assertions
assert.strictEqual(mappedJs, 'mapped-js');
assert.strictEqual(mappedJsx, 'mapped-jsx');
assert.strictEqual(mappedTsx, 'mapped-tsx');
