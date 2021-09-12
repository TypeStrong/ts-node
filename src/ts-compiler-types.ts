import type * as _ts from 'typescript';

/**
 * Common TypeScript interfaces between versions.
 */
export interface TSCommon {
  version: typeof _ts.version;
  sys: typeof _ts.sys;
  ScriptSnapshot: typeof _ts.ScriptSnapshot;
  displayPartsToString: typeof _ts.displayPartsToString;
  createLanguageService: typeof _ts.createLanguageService;
  getDefaultLibFilePath: typeof _ts.getDefaultLibFilePath;
  getPreEmitDiagnostics: typeof _ts.getPreEmitDiagnostics;
  flattenDiagnosticMessageText: typeof _ts.flattenDiagnosticMessageText;
  transpileModule: typeof _ts.transpileModule;
  ModuleKind: typeof _ts.ModuleKind;
  ScriptTarget: typeof _ts.ScriptTarget;
  findConfigFile: typeof _ts.findConfigFile;
  readConfigFile: typeof _ts.readConfigFile;
  parseJsonConfigFileContent: typeof _ts.parseJsonConfigFileContent;
  formatDiagnostics: typeof _ts.formatDiagnostics;
  formatDiagnosticsWithColorAndContext: typeof _ts.formatDiagnosticsWithColorAndContext;

  createDocumentRegistry: typeof _ts.createDocumentRegistry;
  JsxEmit: typeof _ts.JsxEmit;
  createModuleResolutionCache: typeof _ts.createModuleResolutionCache;
  resolveModuleName: typeof _ts.resolveModuleName;
  resolveModuleNameFromCache: typeof _ts.resolveModuleNameFromCache;
  resolveTypeReferenceDirective: typeof _ts.resolveTypeReferenceDirective;
  createIncrementalCompilerHost: typeof _ts.createIncrementalCompilerHost;
  createSourceFile: typeof _ts.createSourceFile;
  getDefaultLibFileName: typeof _ts.getDefaultLibFileName;
  createIncrementalProgram: typeof _ts.createIncrementalProgram;
  createEmitAndSemanticDiagnosticsBuilderProgram: typeof _ts.createEmitAndSemanticDiagnosticsBuilderProgram;

  Extension: typeof _ts.Extension;
  ModuleResolutionKind: typeof _ts.ModuleResolutionKind;
}

/**
 * Compiler APIs we use that are marked internal and not included in TypeScript's public API declarations
 * @internal
 */
export interface TSInternal {
  // https://github.com/microsoft/TypeScript/blob/4a34294908bed6701dcba2456ca7ac5eafe0ddff/src/compiler/core.ts#L1906-L1909
  createGetCanonicalFileName(
    useCaseSensitiveFileNames: boolean
  ): TSInternal.GetCanonicalFileName;
  // https://github.com/microsoft/TypeScript/blob/c117c266e09c80e8a06b24a6e94b9d018f5fae6b/src/compiler/commandLineParser.ts#L2054
  convertToTSConfig(
    configParseResult: _ts.ParsedCommandLine,
    configFileName: string,
    host: TSInternal.ConvertToTSConfigHost
  ): any;
  libs?: string[];
  Diagnostics: {
    File_0_not_found: _ts.DiagnosticMessage;
  };
  createCompilerDiagnostic(
    message: _ts.DiagnosticMessage,
    ...args: (string | number | undefined)[]
  ): _ts.Diagnostic;
  nodeModuleNameResolver(
    moduleName: string,
    containingFile: string,
    compilerOptions: _ts.CompilerOptions,
    host: _ts.ModuleResolutionHost,
    cache?: _ts.ModuleResolutionCache,
    redirectedReference?: _ts.ResolvedProjectReference,
    lookupConfig?: boolean
  ): _ts.ResolvedModuleWithFailedLookupLocations;
}
/** @internal */
export namespace TSInternal {
  // https://github.com/microsoft/TypeScript/blob/4a34294908bed6701dcba2456ca7ac5eafe0ddff/src/compiler/core.ts#L1906
  export type GetCanonicalFileName = (fileName: string) => string;
  // https://github.com/microsoft/TypeScript/blob/c117c266e09c80e8a06b24a6e94b9d018f5fae6b/src/compiler/commandLineParser.ts#L2041
  export interface ConvertToTSConfigHost {
    getCurrentDirectory(): string;
    useCaseSensitiveFileNames: boolean;
  }
}
