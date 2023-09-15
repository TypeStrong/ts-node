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
    return (
      typeof (ts.ScriptTarget as any)[config.compilerOptions.target.toUpperCase()] === 'number' &&
      typeof (ts.ModuleKind as any)[config.compilerOptions.module.toUpperCase()] === 'number' &&
      typeof (ts.ModuleResolutionKind as any)[config.compilerOptions.moduleResolution.toUpperCase()] === 'number' &&
      tsInternal.libs &&
      config.compilerOptions.lib.every((lib) => tsInternal.libs!.includes(lib))
    );
  }
}
