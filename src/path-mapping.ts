import type * as ts from 'typescript';
import { join as joinPath } from 'path';

// Path mapper returns a list of mapped specifiers or `null` if the
// given `specifier` was not mapped.
type PathMapper = (specifier: string) => string[] | null;

export function createPathMapper(
  compilerOptions: ts.CompilerOptions
): PathMapper {
  if (compilerOptions.paths) {
    if (!compilerOptions.baseUrl) {
      throw new Error(`Compiler option 'baseUrl' required when 'paths' is set`);
    }

    const mappings = Object.entries(compilerOptions.paths).map(
      ([patternString, outputs]) => ({
        pattern: parsePattern(patternString),
        outputs,
      })
    );
    const mappingConfig = { mappings, baseUrl: compilerOptions.baseUrl };

    return function map(specifier: string): string[] | null {
      return mapPath(mappingConfig, specifier);
    };
  } else {
    return () => null;
  }
}

interface MappingConfig {
  mappings: Mapping[];
  baseUrl: string;
}

interface Mapping {
  pattern: Pattern;
  outputs: string[];
}

type Pattern =
  | {
      type: 'wildcard';
      prefix: string;
      suffix: string;
    }
  | { type: 'static'; value: string };

function mapPath(mappingConfig: MappingConfig, path: string): string[] | null {
  let bestMatchWeight = -Infinity;
  let bestMatch: [Mapping, string] | null = null;

  for (const mapping of mappingConfig.mappings) {
    if (patternWeight(mapping.pattern) > bestMatchWeight) {
      const match = matchPattern(mapping.pattern, path);
      if (match !== null) {
        bestMatch = [mapping, match];
        bestMatchWeight = patternWeight(mapping.pattern);
      }
    }
  }

  if (bestMatch) {
    const [mapping, match] = bestMatch;
    return mapping.outputs.map((output) =>
      joinPath(mappingConfig.baseUrl, output.replace('*', match))
    );
  } else {
    return null;
  }
}

// Return the submatch when the pattern matches.
//
// For the wildcard pattern string `a*z` and candidate `afooz` this
// returns `foo`. For the static pattern `bar` and the candidate `bar`
// this returns `bar`.
function matchPattern(pattern: Pattern, candidate: string): string | null {
  switch (pattern.type) {
    case 'wildcard':
      if (
        candidate.length >= pattern.prefix.length + pattern.suffix.length &&
        candidate.startsWith(pattern.prefix) &&
        candidate.endsWith(pattern.suffix)
      ) {
        return candidate.substring(
          pattern.prefix.length,
          candidate.length - pattern.suffix.length
        );
      } else {
        return null;
      }
    case 'static':
      if (pattern.value === candidate) {
        return candidate;
      } else {
        return null;
      }
  }
}

// Pattern weight to sort best matches.
//
// Static patterns have the highest weight. For wildcard patterns the
// weight is determined by the length of the prefix before the glob
// `*`.
function patternWeight(pattern: Pattern): number {
  if (pattern.type === 'wildcard') {
    return pattern.prefix.length;
  } else {
    return Infinity;
  }
}

function parsePattern(patternString: string): Pattern {
  const indexOfStar = patternString.indexOf('*');
  if (indexOfStar === -1) {
    return { type: 'static', value: patternString };
  }

  if (patternString.indexOf('*', indexOfStar + 1) !== -1) {
    throw new Error(`Path pattern ${patternString} contains two wildcards '*'`);
  }

  return {
    type: 'wildcard',
    prefix: patternString.substring(0, indexOfStar),
    suffix: patternString.substring(indexOfStar + 1),
  };
}
