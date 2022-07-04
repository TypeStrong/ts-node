// These files are resolved by the typechecker
import * as tsmie from 'external/typescript-module-imported-externally';
import * as jsmie from 'external/javascript-module-imported-externally';
// These files are unknown to the compiler until required.
const tsmre = require('external/typescript-module-required-externally');
const jsmre = require('external/javascript-module-required-externally');

import * as external from 'external';

console.log(JSON.stringify({ external, tsmie, jsmie, tsmre, jsmre }, null, 2));
