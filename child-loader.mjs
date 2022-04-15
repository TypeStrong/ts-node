import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(fileURLToPath(import.meta.url));

/** @type {import('./dist/child-loader')} */
const childLoader = require('./dist/child/child-loader');
export const { resolve, load, getFormat, transformSource } = childLoader;
