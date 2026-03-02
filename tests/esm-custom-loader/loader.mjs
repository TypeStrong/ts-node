import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(fileURLToPath(import.meta.url));

/** @type {import('../../dist')} **/
const { createEsmHooks, register } = require('ts-node');

const tsNodeInstance = register({
  compilerOptions: {
    noUnusedLocals: true,
  },
});

export const { resolve, getFormat, transformSource, load } = createEsmHooks(tsNodeInstance);
