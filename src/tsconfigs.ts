import type * as _ts from "typescript";

const nodeMajor = parseInt(process.versions.node.split('.')[0], 10)
/**
 * return parsed JSON of the bundled @tsconfig/bases config appropriate for the
 * running version of nodejs
 */
export function getDefaultTsconfigJsonForNodeVersion(): any {
  return nodeMajor >= 14 ? require('@tsconfig/node14/tsconfig.json') :
    nodeMajor >= 12 ? require('@tsconfig/node12/tsconfig.json') :
    require('@tsconfig/node10/tsconfig.json')
}
