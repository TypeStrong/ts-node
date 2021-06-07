import { isAbsolute, resolve } from 'path';
import { cachedLookup, normalizeSlashes } from './util';
import type * as _ts from 'typescript';
import type { TSCommon, TSInternal } from './ts-compiler-types';

export const createTsInternals = cachedLookup(createTsInternalsUncached);
/**
 * Given a reference to the TS compiler, return some TS internal functions that we
 * could not or did not want to grab off the `ts` object.
 * These have been copy-pasted from TS's source and tweaked as necessary.
 */
function createTsInternalsUncached(_ts: TSCommon) {
  const ts = _ts as TSCommon & TSInternal;
  /**
   * Copied from:
   * https://github.com/microsoft/TypeScript/blob/v4.3.2/src/compiler/commandLineParser.ts#L2821-L2846
   */
  function getExtendsConfigPath(
    extendedConfig: string,
    host: _ts.ParseConfigHost,
    basePath: string,
    errors: _ts.Push<_ts.Diagnostic>,
    createDiagnostic: (
      message: _ts.DiagnosticMessage,
      arg1?: string
    ) => _ts.Diagnostic
  ) {
    extendedConfig = normalizeSlashes(extendedConfig);
    if (
      isRootedDiskPath(extendedConfig) ||
      startsWith(extendedConfig, './') ||
      startsWith(extendedConfig, '../')
    ) {
      let extendedConfigPath = getNormalizedAbsolutePath(
        extendedConfig,
        basePath
      );
      if (
        !host.fileExists(extendedConfigPath) &&
        !endsWith(extendedConfigPath, ts.Extension.Json)
      ) {
        extendedConfigPath = `${extendedConfigPath}.json`;
        if (!host.fileExists(extendedConfigPath)) {
          errors.push(
            createDiagnostic(ts.Diagnostics.File_0_not_found, extendedConfig)
          );
          return undefined;
        }
      }
      return extendedConfigPath;
    }
    // If the path isn't a rooted or relative path, resolve like a module
    const resolved = ts.nodeModuleNameResolver(
      extendedConfig,
      combinePaths(basePath, 'tsconfig.json'),
      { moduleResolution: ts.ModuleResolutionKind.NodeJs },
      host,
      /*cache*/ undefined,
      /*projectRefs*/ undefined,
      /*lookupConfig*/ true
    );
    if (resolved.resolvedModule) {
      return resolved.resolvedModule.resolvedFileName;
    }
    errors.push(
      createDiagnostic(ts.Diagnostics.File_0_not_found, extendedConfig)
    );
    return undefined;
  }

  function startsWith(str: string, prefix: string): boolean {
    return str.lastIndexOf(prefix, 0) === 0;
  }
  function endsWith(str: string, suffix: string): boolean {
    const expectedPos = str.length - suffix.length;
    return expectedPos >= 0 && str.indexOf(suffix, expectedPos) === expectedPos;
  }

  // These functions have alternative implementation to avoid copying too much from TS
  function isRootedDiskPath(path: string) {
    return isAbsolute(path);
  }
  function combinePaths(
    path: string,
    ...paths: (string | undefined)[]
  ): string {
    return normalizeSlashes(
      resolve(path, ...(paths.filter((path) => path) as string[]))
    );
  }
  function getNormalizedAbsolutePath(
    fileName: string,
    currentDirectory: string | undefined
  ) {
    return normalizeSlashes(
      currentDirectory != null
        ? resolve(currentDirectory!, fileName)
        : resolve(fileName)
    );
  }

  return { getExtendsConfigPath };
}
