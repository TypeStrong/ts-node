import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(fileURLToPath(import.meta.url));

/** @type {import('./dist/esm')} */
const esm = require('./dist/esm');

/** @type {ReturnType<typeof esm['registerAndCreateEsmHooks']> | undefined} */
let loader = undefined;

export function resolve(...args) {
  if (!loader) initialize();
  return loader.resolve.apply(this, args);
}

export function load(...args) {
  if (!loader) initialize();
  return loader.load.apply(this, args);
}

export function getFormat(...args) {
  if (!loader) initialize();
  return loader.getFormat.apply(this, args);
}

export function transformSource(...args) {
  if (!loader) initialize();
  return loader.transformSource.apply(this, args);
}

export function initialize(tsNodeOptions) {
  loader = esm.registerAndCreateEsmHooks(tsNodeOptions);
}
