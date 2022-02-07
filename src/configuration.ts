import { resolve, dirname } from 'path';
import type * as _ts from 'typescript';
import {
  CreateOptions,
  DEFAULTS,
  OptionBasePaths,
  TSCommon,
  TsConfigOptions,
} from './index';
import type { TSInternal } from './ts-compiler-types';
import { createTsInternals } from './ts-internals';
import { getDefaultTsconfigJsonForNodeVersion } from './tsconfigs';
import { assign, createProjectLocalResolveHelper } from './util';

/**
 * TypeScript compiler option values required by `ts-node` which cannot be overridden.
 */
const TS_NODE_COMPILER_OPTIONS = {
  sourceMap: true,
  inlineSourceMap: false,
  inlineSources: true,
  declaration: false,
  noEmit: false,
  outDir: '.ts-node',
};

/*
 * Do post-processing on config options to support `ts-node`.
 */
function fixConfig(ts: TSCommon, config: _ts.ParsedCommandLine) {
  // Delete options that *should not* be passed through.
  delete config.options.out;
  delete config.options.outFile;
  delete config.options.composite;
  delete config.options.declarationDir;
  delete config.options.declarationMap;
  delete config.options.emitDeclarationOnly;

  // Target ES5 output by default (instead of ES3).
  if (config.options.target === undefined) {
    config.options.target = ts.ScriptTarget.ES5;
  }

  // Target CommonJS modules by default (instead of magically switching to ES6 when the target is ES6).
  if (config.options.module === undefined) {
    config.options.module = ts.ModuleKind.CommonJS;
  }

  return config;
}

/**
 * Load TypeScript configuration. Returns the parsed TypeScript config and
 * any `ts-node` options specified in the config file.
 *
 * Even when a tsconfig.json is not loaded, this function still handles merging
 * compilerOptions from various sources: API, environment variables, etc.
 *
 * @internal
 */
export function readConfig(
  cwd: string,
  ts: TSCommon,
  rawApiOptions: CreateOptions
): {
  /**
   * Path of tsconfig file if one was loaded
   */
  configFilePath: string | undefined;
  /**
   * Parsed TypeScript configuration with compilerOptions merged from all other sources (env vars, etc)
   */
  config: _ts.ParsedCommandLine;
  /**
   * ts-node options pulled from `tsconfig.json`, NOT merged with any other sources.  Merging must happen outside
   * this function.
   */
  tsNodeOptionsFromTsconfig: TsConfigOptions;
  optionBasePaths: OptionBasePaths;
} {
  // Ordered [a, b, c] where config a extends b extends c
  const configChain: Array<{
    config: any;
    basePath: string;
    configPath: string;
  }> = [];
  let config: any = { compilerOptions: {} };
  let basePath = cwd;
  let configFilePath: string | undefined = undefined;
  const projectSearchDir = resolve(cwd, rawApiOptions.projectSearchDir ?? cwd);

  const {
    fileExists = ts.sys.fileExists,
    readFile = ts.sys.readFile,
    skipProject = DEFAULTS.skipProject,
    project = DEFAULTS.project,
    tsTrace = DEFAULTS.tsTrace,
  } = rawApiOptions;

  // Read project configuration when available.
  if (!skipProject) {
    configFilePath = project
      ? resolve(cwd, project)
      : ts.findConfigFile(projectSearchDir, fileExists);

    if (configFilePath) {
      let pathToNextConfigInChain = configFilePath;
      const tsInternals = createTsInternals(ts);
      const errors: Array<_ts.Diagnostic> = [];

      // Follow chain of "extends"
      while (true) {
        const result = ts.readConfigFile(pathToNextConfigInChain, readFile);

        // Return diagnostics.
        if (result.error) {
          return {
            configFilePath,
            config: { errors: [result.error], fileNames: [], options: {} },
            tsNodeOptionsFromTsconfig: {},
            optionBasePaths: {},
          };
        }

        const c = result.config;
        const bp = dirname(pathToNextConfigInChain);
        configChain.push({
          config: c,
          basePath: bp,
          configPath: pathToNextConfigInChain,
        });

        if (c.extends == null) break;
        const resolvedExtendedConfigPath = tsInternals.getExtendsConfigPath(
          c.extends,
          {
            fileExists,
            readDirectory: ts.sys.readDirectory,
            readFile,
            useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
            trace: tsTrace,
          },
          bp,
          errors,
          (ts as unknown as TSInternal).createCompilerDiagnostic
        );
        if (errors.length) {
          return {
            configFilePath,
            config: { errors, fileNames: [], options: {} },
            tsNodeOptionsFromTsconfig: {},
            optionBasePaths: {},
          };
        }
        if (resolvedExtendedConfigPath == null) break;
        pathToNextConfigInChain = resolvedExtendedConfigPath;
      }

      ({ config, basePath } = configChain[0]);
    }
  }

  // Merge and fix ts-node options that come from tsconfig.json(s)
  const tsNodeOptionsFromTsconfig: TsConfigOptions = {};
  const optionBasePaths: OptionBasePaths = {};
  for (let i = configChain.length - 1; i >= 0; i--) {
    const { config, basePath, configPath } = configChain[i];
    const options = filterRecognizedTsConfigTsNodeOptions(
      config['ts-node']
    ).recognized;

    // Some options are relative to the config file, so must be converted to absolute paths here
    if (options.require) {
      // Modules are found relative to the tsconfig file, not the `dir` option
      const tsconfigRelativeResolver = createProjectLocalResolveHelper(
        dirname(configPath)
      );
      options.require = options.require.map((path: string) =>
        tsconfigRelativeResolver(path, false)
      );
    }
    if (options.scopeDir) {
      options.scopeDir = resolve(basePath, options.scopeDir!);
    }

    // Downstream code uses the basePath; we do not do that here.
    if (options.moduleTypes) {
      optionBasePaths.moduleTypes = basePath;
    }
    if (options.transpiler != null) {
      optionBasePaths.transpiler = basePath;
    }
    if (options.compiler != null) {
      optionBasePaths.compiler = basePath;
    }

    assign(tsNodeOptionsFromTsconfig, options);
  }

  // Remove resolution of "files".
  const files =
    rawApiOptions.files ?? tsNodeOptionsFromTsconfig.files ?? DEFAULTS.files;
  if (!files) {
    config.files = [];
    config.include = [];
  }

  // Only if a config file is *not* loaded, load an implicit configuration from @tsconfig/bases
  const skipDefaultCompilerOptions = configFilePath != null;
  const defaultCompilerOptionsForNodeVersion = skipDefaultCompilerOptions
    ? undefined
    : {
        ...getDefaultTsconfigJsonForNodeVersion(ts).compilerOptions,
        types: ['node'],
      };

  // Merge compilerOptions from all sources
  config.compilerOptions = Object.assign(
    {},
    // automatically-applied options from @tsconfig/bases
    defaultCompilerOptionsForNodeVersion,
    // tsconfig.json "compilerOptions"
    config.compilerOptions,
    // from env var
    DEFAULTS.compilerOptions,
    // tsconfig.json "ts-node": "compilerOptions"
    tsNodeOptionsFromTsconfig.compilerOptions,
    // passed programmatically
    rawApiOptions.compilerOptions,
    // overrides required by ts-node, cannot be changed
    TS_NODE_COMPILER_OPTIONS
  );

  const fixedConfig = fixConfig(
    ts,
    ts.parseJsonConfigFileContent(
      config,
      {
        fileExists,
        readFile,
        readDirectory: ts.sys.readDirectory,
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
      },
      basePath,
      undefined,
      configFilePath
    )
  );

  return {
    configFilePath,
    config: fixedConfig,
    tsNodeOptionsFromTsconfig,
    optionBasePaths,
  };
}

/**
 * Given the raw "ts-node" sub-object from a tsconfig, return an object with only the properties
 * recognized by "ts-node"
 */
function filterRecognizedTsConfigTsNodeOptions(jsonObject: any): {
  recognized: TsConfigOptions;
  unrecognized: any;
} {
  if (jsonObject == null) return { recognized: {}, unrecognized: {} };
  const {
    compiler,
    compilerHost,
    compilerOptions,
    emit,
    files,
    ignore,
    ignoreDiagnostics,
    logError,
    preferTsExts,
    pretty,
    require,
    skipIgnore,
    transpileOnly,
    typeCheck,
    transpiler,
    scope,
    scopeDir,
    moduleTypes,
    experimentalReplAwait,
    swc,
    experimentalResolverFeatures,
    ...unrecognized
  } = jsonObject as TsConfigOptions;
  const filteredTsConfigOptions = {
    compiler,
    compilerHost,
    compilerOptions,
    emit,
    experimentalReplAwait,
    files,
    ignore,
    ignoreDiagnostics,
    logError,
    preferTsExts,
    pretty,
    require,
    skipIgnore,
    transpileOnly,
    typeCheck,
    transpiler,
    scope,
    scopeDir,
    moduleTypes,
    swc,
    experimentalResolverFeatures,
  };
  // Use the typechecker to make sure this implementation has the correct set of properties
  const catchExtraneousProps: keyof TsConfigOptions =
    null as any as keyof typeof filteredTsConfigOptions;
  const catchMissingProps: keyof typeof filteredTsConfigOptions =
    null as any as keyof TsConfigOptions;
  return { recognized: filteredTsConfigOptions, unrecognized };
}
