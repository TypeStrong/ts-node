import { env } from '.';
import { yn } from './util';

/**
 * Debugging `ts-node`.
 */
const shouldDebug = yn(env.TS_NODE_DEBUG);
/** @internal */
export const debug = shouldDebug
  ? (...args: any) =>
      console.log(`[ts-node ${new Date().toISOString()}]`, ...args)
  : () => undefined;
/** @internal */
export const debugFn = shouldDebug
  ? <T, U>(key: string, fn: (arg: T) => U) => {
      let i = 0;
      return (x: T) => {
        debug(key, x, ++i);
        return fn(x);
      };
    }
  : <T, U>(_: string, fn: (arg: T) => U) => fn;
