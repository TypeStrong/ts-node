import type { TSCommon, TSInternal } from './ts-compiler-types';

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
/**
 * return parsed JSON of the bundled @tsconfig/bases config appropriate for the
 * running version of nodejs
 * @internal
 */
export function getDefaultTsconfigJsonForNodeVersion(ts: TSCommon): any {
  const tsInternal = ts as any as TSInternal;
  if (nodeMajor >= 20) {
    const config = require('@tsconfig/node20/tsconfig.json');
    if (configCompatible(config)) return config;
  }
  if (nodeMajor >= 18) {
    const config = require('@tsconfig/node18/tsconfig.json');
    if (configCompatible(config)) return config;
  }
  if (nodeMajor >= 16) {
    const config = require('@tsconfig/node16/tsconfig.json');
    if (configCompatible(config)) return config;
  }
  {
    const config = require('@tsconfig/node14/tsconfig.json');
    if (configCompatible(config)) return config;
  }
  // Old TypeScript compilers may be incompatible with *all* @tsconfig/node* configs,
  // so fallback to nothing
  return {};

  // Verify that tsconfig target and lib options are compatible with TypeScript compiler
  function configCompatible(config: {
    compilerOptions: {
      lib: string[];
      target: string;
      module: string;
      moduleResolution: string;
    };
  }) {
    const results = ts.parseJsonConfigFileContent(
      {
        compilerOptions: config.compilerOptions,
        files: ['foo.ts'],
      },
      parseConfigHost,
      ''
    );
    return results.errors.length === 0;
  }
}

const parseConfigHost = {
  useCaseSensitiveFileNames: false,
  readDirectory(
    rootDir: string,
    extensions: readonly string[],
    excludes: readonly string[] | undefined,
    includes: readonly string[],
    depth?: number
  ) {
    return [];
  },
  fileExists(path: string) {
    return false;
  },
  readFile(path: string) {
    return '';
  },
};
