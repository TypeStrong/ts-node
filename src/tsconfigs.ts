import type { TSCommon, TSInternal } from './ts-compiler-types';

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
/**
 * return parsed JSON of the bundled @tsconfig/bases config appropriate for the
 * running version of nodejs
 * @internal
 */
export function getDefaultTsconfigJsonForNodeVersion(ts: TSCommon): any {
  const tsInternal = ts as any as TSInternal;
  if (nodeMajor >= 18) {
    const config = require('@tsconfig/node18/tsconfig.json');
    if (configCompatible(config)) return config;
  }
  if (nodeMajor >= 16) {
    const config = require('@tsconfig/node16/tsconfig.json');
    if (configCompatible(config)) return config;
  }
  return require('@tsconfig/node14/tsconfig.json');

  // Verify that tsconfig target and lib options are compatible with TypeScript compiler
  function configCompatible(config: {
    compilerOptions: {
      lib: string[];
      target: string;
    };
  }) {
    return (
      typeof (ts.ScriptTarget as any)[config.compilerOptions.target.toUpperCase()] === 'number' &&
      tsInternal.libs &&
      config.compilerOptions.lib.every((lib) => tsInternal.libs!.includes(lib))
    );
  }
}
