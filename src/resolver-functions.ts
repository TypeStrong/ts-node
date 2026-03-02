import { resolve } from 'path';
import type { CreateOptions } from '.';
import type { Extensions } from './file-extensions';
import type { TSCommon, TSInternal } from './ts-compiler-types';
import type { ProjectLocalResolveHelper } from './util';

/**
 * @internal
 * In a factory because these are shared across both CompilerHost and LanguageService codepaths
 */
export function createResolverFunctions(kwargs: {
  ts: TSCommon;
  host: TSCommon.ModuleResolutionHost;
  cwd: string;
  getCanonicalFileName: (filename: string) => string;
  config: TSCommon.ParsedCommandLine;
  projectLocalResolveHelper: ProjectLocalResolveHelper;
  options: CreateOptions;
  extensions: Extensions;
}) {
  const { host, ts, config, cwd, getCanonicalFileName, projectLocalResolveHelper, options, extensions } = kwargs;
  const moduleResolutionCache = ts.createModuleResolutionCache(cwd, getCanonicalFileName, config.options);
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
  const fixupResolvedModule = (resolvedModule: TSCommon.ResolvedModule | TSCommon.ResolvedTypeReferenceDirective) => {
    const { resolvedFileName } = resolvedModule;
    if (resolvedFileName === undefined) return;
    // [MUST_UPDATE_FOR_NEW_FILE_EXTENSIONS]
    // .ts,.mts,.cts is always switched to internal
    // .js is switched on-demand
    if (
      resolvedModule.isExternalLibraryImport &&
      ((resolvedFileName.endsWith('.ts') && !resolvedFileName.endsWith('.d.ts')) ||
        (resolvedFileName.endsWith('.cts') && !resolvedFileName.endsWith('.d.cts')) ||
        (resolvedFileName.endsWith('.mts') && !resolvedFileName.endsWith('.d.mts')) ||
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
  const resolveModuleNames: TSCommon.LanguageServiceHost['resolveModuleNames'] = (
    moduleNames: string[],
    containingFile: string,
    reusedNames: string[] | undefined,
    redirectedReference: TSCommon.ResolvedProjectReference | undefined,
    optionsOnlyWithNewerTsVersions: TSCommon.CompilerOptions,
    containingSourceFile?: TSCommon.SourceFile
  ): (TSCommon.ResolvedModule | undefined)[] => {
    return moduleNames.map((moduleName, i) => {
      const mode = containingSourceFile
        ? (ts as any as TSInternal).getModeForResolutionAtIndex?.(containingSourceFile, i)
        : undefined;
      let { resolvedModule } = ts.resolveModuleName(
        moduleName,
        containingFile,
        config.options,
        host,
        moduleResolutionCache,
        redirectedReference,
        mode
      );
      if (!resolvedModule && options.experimentalTsImportSpecifiers) {
        const lastDotIndex = moduleName.lastIndexOf('.');
        const ext = lastDotIndex >= 0 ? moduleName.slice(lastDotIndex) : '';
        if (ext) {
          const replacements = extensions.tsResolverEquivalents.get(ext);
          for (const replacementExt of replacements ?? []) {
            ({ resolvedModule } = ts.resolveModuleName(
              moduleName.slice(0, -ext.length) + replacementExt,
              containingFile,
              config.options,
              host,
              moduleResolutionCache,
              redirectedReference,
              mode
            ));
            if (resolvedModule) break;
          }
        }
      }
      if (resolvedModule) {
        fixupResolvedModule(resolvedModule);
      }
      return resolvedModule;
    });
  };

  // language service never calls this, but TS docs recommend that we implement it
  const getResolvedModuleWithFailedLookupLocationsFromCache: TSCommon.LanguageServiceHost['getResolvedModuleWithFailedLookupLocationsFromCache'] =
    (
      moduleName,
      containingFile,
      resolutionMode?: TSCommon.ModuleKind.CommonJS | TSCommon.ModuleKind.ESNext
    ): TSCommon.ResolvedModuleWithFailedLookupLocations | undefined => {
      const ret = ts.resolveModuleNameFromCache(moduleName, containingFile, moduleResolutionCache, resolutionMode);
      if (ret && ret.resolvedModule) {
        fixupResolvedModule(ret.resolvedModule);
      }
      return ret;
    };

  const resolveTypeReferenceDirectives: TSCommon.LanguageServiceHost['resolveTypeReferenceDirectives'] = (
    typeDirectiveNames: string[] | readonly TSCommon.FileReference[],
    containingFile: string,
    redirectedReference: TSCommon.ResolvedProjectReference | undefined,
    options: TSCommon.CompilerOptions,
    containingFileMode?: TSCommon.SourceFile['impliedNodeFormat'] | undefined // new impliedNodeFormat is accepted by compilerHost
  ): (TSCommon.ResolvedTypeReferenceDirective | undefined)[] => {
    // Note: seems to be called with empty typeDirectiveNames array for all files.
    // TODO consider using `ts.loadWithTypeDirectiveCache`
    return typeDirectiveNames.map((typeDirectiveName) => {
      // Copy-pasted from TS source:
      const nameIsString = typeof typeDirectiveName === 'string';
      const mode = nameIsString
        ? undefined
        : (ts as any as TSInternal).getModeForFileReference!(typeDirectiveName, containingFileMode);
      const strName = nameIsString ? typeDirectiveName : typeDirectiveName.fileName.toLowerCase();
      let { resolvedTypeReferenceDirective } = ts.resolveTypeReferenceDirective(
        strName,
        containingFile,
        config.options,
        host,
        redirectedReference,
        undefined,
        mode
      );
      if (typeDirectiveName === 'node' && !resolvedTypeReferenceDirective) {
        // Resolve @types/node relative to project first, then __dirname (copy logic from elsewhere / refactor into reusable function)
        let typesNodePackageJsonPath: string | undefined;
        try {
          typesNodePackageJsonPath = projectLocalResolveHelper('@types/node/package.json', true);
        } catch {} // gracefully do nothing when @types/node is not installed for any reason
        if (typesNodePackageJsonPath) {
          const typeRoots = [resolve(typesNodePackageJsonPath, '../..')];
          ({ resolvedTypeReferenceDirective } = ts.resolveTypeReferenceDirective(
            typeDirectiveName,
            containingFile,
            {
              ...config.options,
              typeRoots,
            },
            host,
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
