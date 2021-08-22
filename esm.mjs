import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(fileURLToPath(import.meta.url));

/** @type {import('./dist/esm')} */
const { createEsmHooks } = require('./dist/esm');

/** @type {import('./dist/index')} */
const { register } = require('./dist/index');

// Automatically performs registration just like `-r ts-node/register`
const tsNodeInstance = register({
  experimentalEsmLoader: true,
});

export const { resolve, getFormat, transformSource } = createEsmHooks(
  tsNodeInstance
);
