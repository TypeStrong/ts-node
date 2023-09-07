import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(fileURLToPath(import.meta.url));

/** @type {import('./dist/esm')} */
const esm = require('./dist/esm');
export const { initialize, resolve, load, getFormat, transformSource, globalPreload } = esm.registerAndCreateEsmHooks();
