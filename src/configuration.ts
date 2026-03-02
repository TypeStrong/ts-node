import { resolve, dirname, join } from 'path';
import type * as _ts from 'typescript';
import { CreateOptions, DEFAULTS, OptionBasePaths, RegisterOptions, TSCommon, TsConfigOptions } from './index';
import type { TSInternal } from './ts-compiler-types';
import { createTsInternals } from './ts-internals';
import { getDefaultTsconfigJsonForNodeVersion } from './tsconfigs';
import {
  assign,
  attemptRequireWithV8CompileCache,
  createProjectLocalResolveHelper,
  getBasePathForProjectLocalDependencyResolution,
} from './util';

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

/** @internal */
export function findAndReadConfig(rawOptions: CreateOptions) {
  const cwd = resolve(rawOptions.cwd ?? rawOptions.dir ?? DEFAULTS.cwd ?? process.cwd());
  const compilerName = rawOptions.compiler ?? DEFAULTS.compiler;

  // Compute minimum options to read the config file.
  let projectLocalResolveDir = getBasePathForProjectLocalDependencyResolution(
    undefined,
    rawOptions.projectSearchDir,
    rawOptions.project,
    cwd
  );
  let { compiler, ts } = resolveAndLoadCompiler(compilerName, projectLocalResolveDir);

  // Read config file and merge new options between env and CLI options.
  const { configFilePath, config, tsNodeOptionsFromTsconfig, optionBasePaths } = readConfig(cwd, ts, rawOptions);

  const options = assign<RegisterOptions>(
    {},
    DEFAULTS,
    tsNodeOptionsFromTsconfig || {},
    { optionBasePaths },
    rawOptions
  );
  options.require = [...(tsNodeOptionsFromTsconfig.require || []), ...(rawOptions.require || [])];

  // Re-resolve the compiler in case it has changed.
  // Compiler is loaded relative to tsconfig.json, so tsconfig discovery may cause us to load a
  // different compiler than we did above, even if the name has not changed.
  if (configFilePath) {
    projectLocalResolveDir = getBasePathForProjectLocalDependencyResolution(
      configFilePath,
      rawOptions.projectSearchDir,
      rawOptions.project,
      cwd
    );
    ({ compiler } = resolveCompiler(options.compiler, optionBasePaths.compiler ?? projectLocalResolveDir));
  }

  return {
    options,
    config,
    projectLocalResolveDir,
    optionBasePaths,
    configFilePath,
    cwd,
    compiler,
  };
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
  let rootConfigPath: string | undefined = undefined;
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
    if (project) {
      const resolved = resolve(cwd, project);
      const nested = join(resolved, 'tsconfig.json');
      rootConfigPath = fileExists(nested) ? nested : resolved;
    } else {
      rootConfigPath = ts.findConfigFile(projectSearchDir, fileExists);
    }

    if (rootConfigPath) {
      // If root extends [a, c] and a extends b, c extends d, then this array will look like:
      // [root, c, d, a, b]
      let configPaths = [rootConfigPath];
      const tsInternals = createTsInternals(ts);
      const errors: Array<_ts.Diagnostic> = [];

      // Follow chain of "extends"
      for (let configPathIndex = 0; configPathIndex < configPaths.length; configPathIndex++) {
        const configPath = configPaths[configPathIndex];
        const result = ts.readConfigFile(configPath, readFile);

        // Return diagnostics.
        if (result.error) {
          return {
            configFilePath: rootConfigPath,
            config: { errors: [result.error], fileNames: [], options: {} },
            tsNodeOptionsFromTsconfig: {},
            optionBasePaths: {},
          };
        }

        const c = result.config;
        const bp = dirname(configPath);
        configChain.push({
          config: c,
          basePath: bp,
          configPath: configPath,
        });

        if (c.extends == null) continue;
        const extendsArray = Array.isArray(c.extends) ? c.extends : [c.extends];
        for (const e of extendsArray) {
          const resolvedExtendedConfigPath = tsInternals.getExtendsConfigPath(
            e,
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
              configFilePath: rootConfigPath,
              config: { errors, fileNames: [], options: {} },
              tsNodeOptionsFromTsconfig: {},
              optionBasePaths: {},
            };
          }
          if (resolvedExtendedConfigPath != null) {
            // Tricky! If "extends" array is [a, c] then this will splice them into this order:
            // [root, c, a]
            // This is what we want.
            configPaths.splice(configPathIndex + 1, 0, resolvedExtendedConfigPath);
          }
        }
      }

      ({ config, basePath } = configChain[0]);
    }
  }

  // Merge and fix ts-node options that come from tsconfig.json(s)
  const tsNodeOptionsFromTsconfig: TsConfigOptions = {};
  const optionBasePaths: OptionBasePaths = {};
  for (let i = configChain.length - 1; i >= 0; i--) {
    const { config, basePath, configPath } = configChain[i];
    const options = filterRecognizedTsConfigTsNodeOptions(config['ts-node']).recognized;

    // Some options are relative to the config file, so must be converted to absolute paths here
    if (options.require) {
      // Modules are found relative to the tsconfig file, not the `dir` option
      const tsconfigRelativeResolver = createProjectLocalResolveHelper(dirname(configPath));
      options.require = options.require.map((path: string) => tsconfigRelativeResolver(path, false));
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
    if (options.swc != null) {
      optionBasePaths.swc = basePath;
    }

    assign(tsNodeOptionsFromTsconfig, options);
  }

  // Remove resolution of "files".
  const files = rawApiOptions.files ?? tsNodeOptionsFromTsconfig.files ?? DEFAULTS.files;

  // Only if a config file is *not* loaded, load an implicit configuration from @tsconfig/bases
  const skipDefaultCompilerOptions = rootConfigPath != null;
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
        // Only used for globbing "files", "include", "exclude"
        // When `files` option disabled, we want to avoid the fs calls
        readDirectory: files ? ts.sys.readDirectory : () => [],
        useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
      },
      basePath,
      undefined,
      rootConfigPath
    )
  );

  return {
    configFilePath: rootConfigPath,
    config: fixedConfig,
    tsNodeOptionsFromTsconfig,
    optionBasePaths,
  };
}

/**
 * Load the typescript compiler. It is required to load the tsconfig but might
 * be changed by the tsconfig, so we have to do this twice.
 * @internal
 */
export function resolveAndLoadCompiler(name: string | undefined, relativeToPath: string) {
  const { compiler } = resolveCompiler(name, relativeToPath);
  const ts = loadCompiler(compiler);
  return { compiler, ts };
}

function resolveCompiler(name: string | undefined, relativeToPath: string) {
  const projectLocalResolveHelper = createProjectLocalResolveHelper(relativeToPath);
  const compiler = projectLocalResolveHelper(name || 'typescript', true);
  return { compiler };
}

/** @internal */
export function loadCompiler(compiler: string): TSCommon {
  return attemptRequireWithV8CompileCache(require, compiler);
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
    experimentalResolver,
    esm,
    experimentalSpecifierResolution,
    experimentalTsImportSpecifiers,
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
    experimentalResolver,
    esm,
    experimentalSpecifierResolution,
    experimentalTsImportSpecifiers,
  };
  // Use the typechecker to make sure this implementation has the correct set of properties
  const catchExtraneousProps: keyof TsConfigOptions = null as any as keyof typeof filteredTsConfigOptions;
  const catchMissingProps: keyof typeof filteredTsConfigOptions = null as any as keyof TsConfigOptions;
  return { recognized: filteredTsConfigOptions, unrecognized };
}

/** @internal */
export const ComputeAsCommonRootOfFiles = Symbol();

/**
 * Some TS compiler options have defaults which are not provided by TS's config parsing functions.
 * This function centralizes the logic for computing those defaults.
 * @internal
 */
export function getTsConfigDefaults(
  config: _ts.ParsedCommandLine,
  basePath: string,
  _files: string[] | undefined,
  _include: string[] | undefined,
  _exclude: string[] | undefined
) {
  const { composite = false } = config.options;
  let rootDir: string | typeof ComputeAsCommonRootOfFiles = config.options.rootDir!;
  if (rootDir == null) {
    if (composite) rootDir = basePath;
    // Return this symbol to avoid computing from `files`, which would require fs calls
    else rootDir = ComputeAsCommonRootOfFiles;
  }
  const { outDir = rootDir } = config.options;
  // Docs are wrong: https://www.typescriptlang.org/tsconfig#include
  // Docs say **, but it's actually **/*; compiler throws error for **
  const include = _files ? [] : ['**/*'];
  const files = _files ?? [];
  // Docs are misleading: https://www.typescriptlang.org/tsconfig#exclude
  // Docs say it excludes node_modules, bower_components, jspm_packages, but actually those are excluded via behavior of "include"
  const exclude = _exclude ?? [outDir]; // TODO technically, outDir is absolute path, but exclude should be relative glob pattern?

  // TODO compute baseUrl

  return { rootDir, outDir, include, files, exclude, composite };
}
