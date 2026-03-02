import { foo } from './foo.js';
import { bar } from './bar.js';
import { baz } from './baz.js';
import { biff } from './biff.js';
import { libfoo } from 'libfoo';

// Test import builtin modules
import { readFileSync } from 'fs';
if (typeof readFileSync !== 'function') throw new Error('failed to import builtin module');

if (typeof module !== 'undefined') throw new Error('module should not exist in ESM');

console.log(`${foo} ${bar} ${baz} ${biff} ${libfoo}`);
