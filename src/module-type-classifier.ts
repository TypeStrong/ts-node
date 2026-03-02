import type { ModuleTypeOverride, ModuleTypes } from '.';
import { getPatternFromSpec } from './ts-internals';
import { cachedLookup, normalizeSlashes } from './util';

// Logic to support our `moduleTypes` option, which allows overriding node's default ESM / CJS
// classification of `.js` files based on package.json `type` field.

/**
 * Seperate internal type because `auto` is clearer than `package`, but changing
 * the public API is a breaking change.
 * @internal
 */
export type InternalModuleTypeOverride = 'cjs' | 'esm' | 'auto';
/** @internal */
export interface ModuleTypeClassification {
  moduleType: InternalModuleTypeOverride;
}
/** @internal */
export interface ModuleTypeClassifierOptions {
  basePath?: string;
  patterns?: ModuleTypes;
}
/** @internal */
export type ModuleTypeClassifier = ReturnType<typeof createModuleTypeClassifier>;
/**
 * @internal
 * May receive non-normalized options -- basePath and patterns -- and will normalize them
 * internally.
 * However, calls to `classifyModule` must pass pre-normalized paths!
 */
export function createModuleTypeClassifier(options: ModuleTypeClassifierOptions) {
  const { patterns, basePath: _basePath } = options;
  const basePath = _basePath !== undefined ? normalizeSlashes(_basePath).replace(/\/$/, '') : undefined;

  const patternTypePairs = Object.entries(patterns ?? []).map(([_pattern, type]) => {
    const pattern = normalizeSlashes(_pattern);
    return { pattern: parsePattern(basePath!, pattern), type };
  });

  const classifications: Record<ModuleTypeOverride, ModuleTypeClassification> = {
    package: {
      moduleType: 'auto',
    },
    cjs: {
      moduleType: 'cjs',
    },
    esm: {
      moduleType: 'esm',
    },
  };
  const auto = classifications.package;

  // Passed path must be normalized!
  function classifyModuleNonCached(path: string): ModuleTypeClassification {
    const matched = matchPatterns(patternTypePairs, (_) => _.pattern, path);
    if (matched) return classifications[matched.type];
    return auto;
  }

  const classifyModule = cachedLookup(classifyModuleNonCached);

  function classifyModuleAuto(path: String) {
    return auto;
  }

  return {
    classifyModuleByModuleTypeOverrides: patternTypePairs.length ? classifyModule : classifyModuleAuto,
  };
}

function parsePattern(basePath: string, patternString: string): RegExp {
  const pattern = getPatternFromSpec(patternString, basePath);
  return pattern !== undefined ? new RegExp(pattern) : /(?:)/;
}

function matchPatterns<T>(objects: T[], getPattern: (t: T) => RegExp, candidate: string): T | undefined {
  for (let i = objects.length - 1; i >= 0; i--) {
    const object = objects[i];
    const pattern = getPattern(object);

    if (pattern?.test(candidate)) {
      return object;
    }
  }
}
