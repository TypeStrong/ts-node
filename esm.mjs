import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(fileURLToPath(import.meta.url));

/** @type {import('./dist/esm')} */
const esm = require('./dist/esm');
export const { resolve, load, getFormat, transformSource } = esm.registerAndCreateEsmHooks();

// Affordance for node 20, where load() happens in an isolated thread
export const globalPreload = () => {
  const self = fileURLToPath(import.meta.url);
  return `
const { createRequire } = getBuiltin('module');
const require = createRequire(${JSON.stringify(self)});
require('./dist/esm').registerAndCreateEsmHooks();
`;
};
