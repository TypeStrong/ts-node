// All mapped imports
const mappedJs = require('mapped/js');
const mappedJsx = require('mapped/jsx');
const mappedTs = require('mapped/ts');
const mappedTsx = require('mapped/tsx');
const foo = require('candidate/foo');
const bar = require('candidate/bar');
const fooBar = require('candidate/foo/bar');
const immobile = require('static');

// Pre-conditions
const assert = require('assert');

// Assertions
assert.strictEqual(mappedTs, 'mapped-ts');
assert.strictEqual(mappedTsx, 'mapped-tsx');
assert.strictEqual(mappedJs, 'mapped-js');
assert.strictEqual(mappedJsx, 'mapped-jsx');
assert.strictEqual(foo, 'candidate-1-foo');
assert.strictEqual(bar, 'candidate-2-bar');
assert.strictEqual(fooBar, 'candidate-foo-bar');
assert.strictEqual(immobile, 'immobile');

// Force this to be a module
export {};
