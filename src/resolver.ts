import type * as _ts from 'typescript';
import {getAbsoluteMappingEntries, MappingEntry} from 'tsconfig-paths/lib/mapping-entry';
import {builtinModules as builtinModulesArray} from 'module';

const builtinModules = new Set(builtinModulesArray);

export function debugIt(config: _ts.ParsedCommandLine) {
  if(config.options.baseUrl != null) {
    const mappingEntries = getAbsoluteMappingEntries(config.options.baseUrl!, config.options.paths ?? {}, true);
    console.dir(mappingEntries);
    console.dir(getPathsToTry(mappingEntries, 'okeydokey'));
  }
}

export function getPathsToTry(
  absolutePathMappings: ReadonlyArray<MappingEntry>,
  requestedModule: string
): ReadonlyArray<string> | undefined {
  if (
    !absolutePathMappings ||
    !requestedModule ||
    requestedModule[0] === "."
  ) {
    return undefined;
  }

  const candidates: Array<string> = [];
  for (const entry of absolutePathMappings) {
    const starMatch =
      entry.pattern === requestedModule
        ? ""
        : matchStar(entry.pattern, requestedModule);
    if (starMatch !== undefined) {
      for (const physicalPathPattern of entry.paths) {
        const physicalPath = physicalPathPattern.replace("*", starMatch);
        candidates.push(physicalPath);
      }
    }
  }
  return candidates;
}

/**
 * Matches pattern with a single star against search.
 * Star must match at least one character to be considered a match.
 * @param pattern for example "foo*"
 * @param search for example "fooawesomebar"
 * @returns the part of search that * matches, or undefined if no match.
 */
function matchStar(pattern: string, search: string): string | undefined {
  if (search.length < pattern.length) {
    return undefined;
  }
  if (pattern === "*") {
    return search;
  }
  const star = pattern.indexOf("*");
  if (star === -1) {
    return undefined;
  }
  const part1 = pattern.substring(0, star);
  const part2 = pattern.substring(star + 1);
  if (search.substr(0, star) !== part1) {
    return undefined;
  }
  if (search.substr(search.length - part2.length) !== part2) {
    return undefined;
  }
  return search.substr(star, search.length - part2.length);
}

// function createMappings(config: _ts.ParsedCommandLine): ResolverCandidates {
//   const ret: ResolverCandidates = {};

//   if(config.options.baseUrl != null) {
//     ret.pathsAbs = Object.create(null);
//     ret.baseUrlAbs = config.options.baseUrl;
//     if(config.options.paths) {
//       for(const [pattern, candidates] of Object.entries(config.options.paths)) {
//         ret.pathsAbs![pattern] = candidates.map(candidate => joinPath(config.options.baseUrl!, candidate));
//       }
//     }
//   }

//   config.options.rootDirs = config.options.rootDirs?.slice();

//   return ret;
// }

// function joinPath(a: string, b: string) {
//   return require('path').join(a, b).replace('\\', '/');
// }

// interface ResolverCandidates {
//   baseUrlAbs?: string;
//   rootDirsAbs?: string[];
//   pathsAbs?: Record<string, Array<string>>;
// }
