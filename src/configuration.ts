import { resolve, dirname } from 'path';
import type * as _ts from 'typescript';
import { CreateOptions, DEFAULTS, TSCommon, TsConfigOptions } from './index';
import { getDefaultTsconfigJsonForNodeVersion } from './tsconfigs';
import { createRequire } from './util';

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
} {
  let config: any = { compilerOptions: {} };
  let basePath = cwd;
  let configFilePath: string | undefined = undefined;
  const projectSearchDir = resolve(cwd, rawApiOptions.projectSearchDir ?? cwd);

  const {
    fileExists = ts.sys.fileExists,
    readFile = ts.sys.readFile,
    skipProject = DEFAULTS.skipProject,
    project = DEFAULTS.project,
  } = rawApiOptions;

  // Read project configuration when available.
  if (!skipProject) {
    configFilePath = project
      ? resolve(cwd, project)
      : ts.findConfigFile(projectSearchDir, fileExists);

    if (configFilePath) {
      const result = ts.readConfigFile(configFilePath, readFile);

      // Return diagnostics.
      if (result.error) {
        return {
          configFilePath,
          config: { errors: [result.error], fileNames: [], options: {} },
          tsNodeOptionsFromTsconfig: {},
        };
      }

      config = result.config;
      basePath = dirname(configFilePath);
    }
  }

  // Fix ts-node options that come from tsconfig.json
  const tsNodeOptionsFromTsconfig: TsConfigOptions = Object.assign(
    {},
    filterRecognizedTsConfigTsNodeOptions(config['ts-node']).recognized
  );

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

  // Some options are relative to the config file, so must be converted to absolute paths here

  if (tsNodeOptionsFromTsconfig.require) {
    // Modules are found relative to the tsconfig file, not the `dir` option
    const tsconfigRelativeRequire = createRequire(configFilePath!);
    tsNodeOptionsFromTsconfig.require = tsNodeOptionsFromTsconfig.require.map(
      (path: string) => {
        return tsconfigRelativeRequire.resolve(path);
      }
    );
  }
  if (tsNodeOptionsFromTsconfig.scopeDir) {
    tsNodeOptionsFromTsconfig.scopeDir = resolve(
      basePath,
      tsNodeOptionsFromTsconfig.scopeDir
    );
  }

  return { configFilePath, config: fixedConfig, tsNodeOptionsFromTsconfig };
}

/**
 * Given the raw "ts-node" sub-object from a tsconfig, return an object with only the properties
 * recognized by "ts-node"
 */
function filterRecognizedTsConfigTsNodeOptions(
  jsonObject: any
): { recognized: TsConfigOptions; unrecognized: any } {
  if (jsonObject == null) return { recognized: jsonObject, unrecognized: {} };
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
    ...unrecognized
  } = jsonObject as TsConfigOptions;
  const filteredTsConfigOptions = {
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
  };
  // Use the typechecker to make sure this implementation has the correct set of properties
  const catchExtraneousProps: keyof TsConfigOptions = (null as any) as keyof typeof filteredTsConfigOptions;
  const catchMissingProps: keyof typeof filteredTsConfigOptions = (null as any) as keyof TsConfigOptions;
  return { recognized: filteredTsConfigOptions, unrecognized };
}
