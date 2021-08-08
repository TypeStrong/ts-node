import { resolve } from 'path';
import type * as _ts from 'typescript';

/**
 * @internal
 * In a factory because these are shared across both CompilerHost and LanguageService codepaths
 */
export function createResolverFunctions(kwargs: {
  ts: typeof _ts;
  serviceHost: _ts.ModuleResolutionHost;
  cwd: string;
  getCanonicalFileName: (filename: string) => string;
  config: _ts.ParsedCommandLine;
  configFilePath: string | undefined;
}) {
  const {
    serviceHost,
    ts,
    config,
    cwd,
    getCanonicalFileName,
    configFilePath,
  } = kwargs;
  const moduleResolutionCache = ts.createModuleResolutionCache(
    cwd,
    getCanonicalFileName,
    config.options
  );
  const knownInternalFilenames = new Set<string>();
  /** "Buckets" (module directories) whose contents should be marked "internal" */
  const internalBuckets = new Set<string>();

  // Get bucket for a source filename.  Bucket is the containing `./node_modules/*/` directory
  // For '/project/node_modules/foo/node_modules/bar/lib/index.js' bucket is '/project/node_modules/foo/node_modules/bar/'
  // For '/project/node_modules/foo/node_modules/@scope/bar/lib/index.js' bucket is '/project/node_modules/foo/node_modules/@scope/bar/'
  const moduleBucketRe = /.*\/node_modules\/(?:@[^\/]+\/)?[^\/]+\//;
  function getModuleBucket(filename: string) {
    const find = moduleBucketRe.exec(filename);
    if (find) return find[0];
    return '';
  }

  // Mark that this file and all siblings in its bucket should be "internal"
  function markBucketOfFilenameInternal(filename: string) {
    internalBuckets.add(getModuleBucket(filename));
  }

  function isFileInInternalBucket(filename: string) {
    return internalBuckets.has(getModuleBucket(filename));
  }

  function isFileKnownToBeInternal(filename: string) {
    return knownInternalFilenames.has(filename);
  }

  /**
   * If we need to emit JS for a file, force TS to consider it non-external
   */
  const fixupResolvedModule = (
    resolvedModule: _ts.ResolvedModule | _ts.ResolvedTypeReferenceDirective
  ) => {
    const { resolvedFileName } = resolvedModule;
    if (resolvedFileName === undefined) return;
    // .ts is always switched to internal
    // .js is switched on-demand
    if (
      resolvedModule.isExternalLibraryImport &&
      ((resolvedFileName.endsWith('.ts') &&
        !resolvedFileName.endsWith('.d.ts')) ||
        isFileKnownToBeInternal(resolvedFileName) ||
        isFileInInternalBucket(resolvedFileName))
    ) {
      resolvedModule.isExternalLibraryImport = false;
    }
    if (!resolvedModule.isExternalLibraryImport) {
      knownInternalFilenames.add(resolvedFileName);
    }
  };
  /*
   * NOTE:
   * Older ts versions do not pass `redirectedReference` nor `options`.
   * We must pass `redirectedReference` to newer ts versions, but cannot rely on `options`, hence the weird argument name
   */
  const resolveModuleNames: _ts.LanguageServiceHost['resolveModuleNames'] = (
    moduleNames: string[],
    containingFile: string,
    reusedNames: string[] | undefined,
    redirectedReference: _ts.ResolvedProjectReference | undefined,
    optionsOnlyWithNewerTsVersions: _ts.CompilerOptions
  ): (_ts.ResolvedModule | undefined)[] => {
    return moduleNames.map((moduleName) => {
      const { resolvedModule } = ts.resolveModuleName(
        moduleName,
        containingFile,
        config.options,
        serviceHost,
        moduleResolutionCache,
        redirectedReference
      );
      if (resolvedModule) {
        fixupResolvedModule(resolvedModule);
      }
      return resolvedModule;
    });
  };

  // language service never calls this, but TS docs recommend that we implement it
  const getResolvedModuleWithFailedLookupLocationsFromCache: _ts.LanguageServiceHost['getResolvedModuleWithFailedLookupLocationsFromCache'] = (
    moduleName,
    containingFile
  ): _ts.ResolvedModuleWithFailedLookupLocations | undefined => {
    const ret = ts.resolveModuleNameFromCache(
      moduleName,
      containingFile,
      moduleResolutionCache
    );
    if (ret && ret.resolvedModule) {
      fixupResolvedModule(ret.resolvedModule);
    }
    return ret;
  };

  const resolveTypeReferenceDirectives: _ts.LanguageServiceHost['resolveTypeReferenceDirectives'] = (
    typeDirectiveNames: string[],
    containingFile: string,
    redirectedReference: _ts.ResolvedProjectReference | undefined,
    options: _ts.CompilerOptions
  ): (_ts.ResolvedTypeReferenceDirective | undefined)[] => {
    // Note: seems to be called with empty typeDirectiveNames array for all files.
    return typeDirectiveNames.map((typeDirectiveName) => {
      let { resolvedTypeReferenceDirective } = ts.resolveTypeReferenceDirective(
        typeDirectiveName,
        containingFile,
        config.options,
        serviceHost,
        redirectedReference
      );
      if (typeDirectiveName === 'node' && !resolvedTypeReferenceDirective) {
        // Resolve @types/node relative to project first, then __dirname (copy logic from elsewhere / refactor into reusable function)
        let typesNodePackageJsonPath: string | undefined;
        try {
          typesNodePackageJsonPath = require.resolve(
            '@types/node/package.json',
            {
              paths: [configFilePath ?? cwd, __dirname],
            }
          );
        } catch {} // gracefully do nothing when @types/node is not installed for any reason
        if (typesNodePackageJsonPath) {
          const typeRoots = [resolve(typesNodePackageJsonPath, '../..')];
          ({
            resolvedTypeReferenceDirective,
          } = ts.resolveTypeReferenceDirective(
            typeDirectiveName,
            containingFile,
            {
              ...config.options,
              typeRoots,
            },
            serviceHost,
            redirectedReference
          ));
        }
      }
      if (resolvedTypeReferenceDirective) {
        fixupResolvedModule(resolvedTypeReferenceDirective);
      }
      return resolvedTypeReferenceDirective;
    });
  };

  return {
    resolveModuleNames,
    getResolvedModuleWithFailedLookupLocationsFromCache,
    resolveTypeReferenceDirectives,
    isFileKnownToBeInternal,
    markBucketOfFilenameInternal,
  };
}
