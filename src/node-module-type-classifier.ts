import { readPackageScope } from '../dist-raw/node-cjs-loader-utils';

/**
 * TODO https://github.com/microsoft/TypeScript/issues/46452#issuecomment-1073145723
 *
 * Determine how to emit a module based on tsconfig "module" and package.json "type"
 *
 * Supports module=nodenext/node12 with transpileOnly, where we cannot ask the
 * TS typechecker to tell us if a file is CJS or ESM.
 *
 * Return values indicate:
 * - cjs
 * - esm
 * - nodecjs == node-flavored cjs where dynamic imports are *not* transformed into `require()`
 * - undefined == emit according to tsconfig `module` config, whatever that is
 * @internal
 */
export function classifyModule(
  filename: string,
  isNodeModuleType: boolean
): 'nodecjs' | 'cjs' | 'esm' | 'nodeesm' | undefined {
  // [MUST_UPDATE_FOR_NEW_FILE_EXTENSIONS]
  const lastDotIndex = filename.lastIndexOf('.');
  const ext = lastDotIndex >= 0 ? filename.slice(lastDotIndex) : '';
  switch (ext) {
    case '.cjs':
    case '.cts':
      return isNodeModuleType ? 'nodecjs' : 'cjs';
    case '.mjs':
    case '.mts':
      return isNodeModuleType ? 'nodeesm' : 'esm';
  }
  if (isNodeModuleType) {
    const packageScope = readPackageScope(filename);
    if (packageScope && packageScope.data.type === 'module') return 'nodeesm';
    return 'nodecjs';
  }
  return undefined;
}
