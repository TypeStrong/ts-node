/** types from ts-node under test */
import { join } from 'path';
import { promisify } from 'util';

import type _createRequire from 'create-require';

import type * as tsNodeTypes from '../../index';

import { TEST_DIR } from './paths';


const createRequire: typeof _createRequire = require('create-require');

export { tsNodeTypes };

// `createRequire` does not exist on older node versions
export const testsDirRequire = createRequire(join(TEST_DIR, 'index.js'));

export const ts = testsDirRequire('typescript') as typeof import('typescript');

export const delay = promisify(setTimeout);

/** Essentially Array:includes, but with tweaked types for checks on enums */
export function isOneOf<V>(value: V, arrayOfPossibilities: ReadonlyArray<V>) {
  return arrayOfPossibilities.includes(value as any);
}
