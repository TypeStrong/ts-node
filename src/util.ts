import {
  createRequire as nodeCreateRequire,
  createRequireFromPath as nodeCreateRequireFromPath,
} from 'module';
import type _createRequire from 'create-require';
import * as ynModule from 'yn';

/** @internal */
export const createRequire =
  nodeCreateRequire ??
  nodeCreateRequireFromPath ??
  (require('create-require') as typeof _createRequire);

/**
 * Wrapper around yn module that returns `undefined` instead of `null`.
 * This is implemented by yn v4, but we're staying on v3 to avoid v4's node 10 requirement.
 * @internal
 */
export function yn(value: string | undefined) {
  return ynModule(value) ?? undefined;
}

/**
 * Like `Object.assign`, but ignores `undefined` properties.
 *
 * @internal
 */
export function assign<T extends object>(
  initialValue: T,
  ...sources: Array<T>
): T {
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      const value = (source as any)[key];
      if (value !== undefined) (initialValue as any)[key] = value;
    }
  }
  return initialValue;
}

/**
 * Split a string array of values.
 * @internal
 */
export function split(value: string | undefined) {
  return typeof value === 'string' ? value.split(/ *, */g) : undefined;
}

/**
 * Parse a string as JSON.
 * @internal
 */
export function parse(value: string | undefined): object | undefined {
  return typeof value === 'string' ? JSON.parse(value) : undefined;
}

const directorySeparator = '/';
const backslashRegExp = /\\/g;
/**
 * Replace backslashes with forward slashes.
 * @internal
 */
export function normalizeSlashes(value: string): string {
  return value.replace(backslashRegExp, directorySeparator);
}

/**
 * Safe `hasOwnProperty`
 * @internal
 */
export function hasOwnProperty(object: any, property: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, property);
}

/**
 * Cached fs operation wrapper.
 */
export function cachedLookup<T, R>(fn: (arg: T) => R): (arg: T) => R {
  const cache = new Map<T, R>();

  return (arg: T): R => {
    if (!cache.has(arg)) {
      const v = fn(arg);
      cache.set(arg, v);
      return v;
    }
    return cache.get(arg)!;
  };
}

/**
 * We do not support ts's `trace` option yet.  In the meantime, rather than omit
 * `trace` options in hosts, I am using this placeholder.
 */
export function trace(s: string): void {}
