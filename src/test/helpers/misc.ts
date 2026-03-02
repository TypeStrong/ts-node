/** types from ts-node under test */
import type * as tsNodeTypes from '../../index';
import { TEST_DIR } from './paths';
import { join } from 'path';
import { promisify } from 'util';
import { createRequire } from 'module';
export { tsNodeTypes };

export const testsDirRequire = createRequire(join(TEST_DIR, 'index.js'));

export const ts = testsDirRequire('typescript') as typeof import('typescript');

export const delay = promisify(setTimeout);

/** Essentially Array:includes, but with tweaked types for checks on enums */
export function isOneOf<V>(value: V, arrayOfPossibilities: ReadonlyArray<V>) {
  return arrayOfPossibilities.includes(value as any);
}
