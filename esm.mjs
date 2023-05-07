import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { versionGteLt } from './dist/util.js';
const require = createRequire(fileURLToPath(import.meta.url));

/** @type {import('./dist/esm')} */
const esm = require('./dist/esm');
export const { resolve, load, getFormat, transformSource } = esm.registerAndCreateEsmHooks();

// Affordance for node 20, where load() happens in an isolated thread
const offThreadLoader = versionGteLt(process.versions.node, '20.0.0');
export const globalPreload = () => {
  if (!offThreadLoader) {
    return '';
  }
  const self = fileURLToPath(import.meta.url);
  return `
const { createRequire } = getBuiltin('module');
const require = createRequire(${JSON.stringify(self)});
require('./dist/esm').registerAndCreateEsmHooks();
`;
};
