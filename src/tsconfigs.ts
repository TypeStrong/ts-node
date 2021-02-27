import { TSCommon } from '.';

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
/**
 * return parsed JSON of the bundled @tsconfig/bases config appropriate for the
 * running version of nodejs
 * @internal
 */
export function getDefaultTsconfigJsonForNodeVersion(ts: TSCommon): any {
  if (nodeMajor >= 14) {
    const config = require('@tsconfig/node14/tsconfig.json');
    if (configCompatible(config)) return config;
  }
  if (nodeMajor >= 12) {
    const config = require('@tsconfig/node12/tsconfig.json');
    if (configCompatible(config)) return config;
  }
  return require('@tsconfig/node10/tsconfig.json');

  // Verify that tsconfig target and lib options are compatible with TypeScript compiler
  function configCompatible(config: {
    compilerOptions: {
      lib: string[];
      target: string;
    };
  }) {
    return (
      typeof (ts.ScriptTarget as any)[
        config.compilerOptions.target.toUpperCase()
      ] === 'number' &&
      ts.libs &&
      config.compilerOptions.lib.every((lib) => ts.libs!.includes(lib))
    );
  }
}
