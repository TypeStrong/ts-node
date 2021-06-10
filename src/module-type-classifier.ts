import { dirname } from 'path';
import { getPatternFromSpec } from './ts-internals';
import { cachedLookup } from './util';

// Logic to support out `moduleTypes` option, which allows overriding node's default ESM / CJS
// classification of `.js` files based on package.json `type` field.

// How to convert glob to RegExp
// Check for `***`; reject with an error
// Check for `/**/`; replace with:  \/.*\/          chomp all slashes before and after, collapse adjacent **/
// Check for `*`;  replace with:  [^/]*
// Check for `?`;  replace with:  .
// Check for ending file extension; if omitted, add logic to match only the correct file extensions
// Escape strings a-la lodash escapeRegexp
// anything matched by the glob can be a

/** @internal */
export type ModuleType = 'cjs' | 'esm' | 'package';
/** @internal */
export interface ModuleTypeClassification {
  moduleType: ModuleType;
}
/** @internal */
export interface ModuleTypeClassifierOptions {
  basePath?: string;
  patterns?: Record<string, ModuleType>;
}
/** @internal */
export type ModuleTypeClassifier = ReturnType<
  typeof createModuleTypeClassifier
>;
/** @internal */
export function createModuleTypeClassifier(
  options: ModuleTypeClassifierOptions
) {
  const { patterns, basePath } = options;

  const patternTypePairs = Object.entries(patterns ?? []).map(
    ([pattern, type]) => {
      return { pattern: parsePattern(basePath!, pattern), type };
    }
  );

  const classifications: Record<ModuleType, ModuleTypeClassification> = {
    package: {
      moduleType: 'package',
    },
    cjs: {
      moduleType: 'cjs',
    },
    esm: {
      moduleType: 'esm',
    },
  };
  const auto = classifications.package;

  // TODO path must be normalized.
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
    classifyModule: patternTypePairs.length
      ? classifyModule
      : classifyModuleAuto,
  };
}

// TODO basePath must be normalized.  Is it?
// TODO basePath cannot end in /
// TODO basePath must be absolute
function parsePattern(basePath: string, patternString: string): RegExp {
  // if (patternString.indexOf('\\') > -1) {
  //   throw new Error(
  //     'moduleTypes patterns cannot contain "\\"; must use Posix path delimiters.  See TODO link to docs'
  //   );
  // }

  // // strip any leading ./ and ../, adjusting basePath to reflect ascensions
  // while (patternString.startsWith('.')) {
  //   if (patternString.startsWith('./')) {
  //     patternString = patternString.slice(2);
  //   } else if (patternString.startsWith('../')) {
  //     basePath = dirname(basePath);
  //     patternString = patternString.slice(3);
  //   } else {
  //     break;
  //   }
  // }
  // const firstAsterisk = patternString.indexOf('*');
  // const lastAsterisk = patternString.lastIndexOf('*');
  // if (firstAsterisk !== lastAsterisk)
  //   throw new Error(
  //     'moduleTypes patterns can contain at most a single asterisk.  See TODO link to docs'
  //   );
  // if (firstAsterisk === -1) return basePath + '/' + patternString;
  // return {
  //   prefix: basePath + '/' + patternString.slice(0, firstAsterisk),
  //   suffix: patternString.slice(firstAsterisk + 1),
  // };
  const pattern = getPatternFromSpec(patternString, basePath);
  return pattern !== undefined ? new RegExp(pattern) : /(?:)/;
}

function matchPatterns<T>(
  objects: T[],
  getPattern: (t: T) => RegExp,
  candidate: string
): T | undefined {
  for (let i = objects.length - 1; i--; i >= 0) {
    const object = objects[i];
    const pattern = getPattern(object);

    if (pattern?.test(candidate)) {
      return object;
    }
  }
}
