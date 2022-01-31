import type Module = require('module');
import type { Service } from '.';
import { isRelativeSpecifier } from './util';

/** @internal */
export type ModuleConstructorWithInternals = typeof Module & {
  _resolveFilename(
    request: string,
    parent?: Module,
    isMain?: boolean,
    options?: ModuleResolveFilenameOptions,
    ...rest: any[]
  ): string;
  _preloadModules(requests?: string[]): void;
};

interface ModuleResolveFilenameOptions {
  paths?: Array<string>;
}

/**
 * @internal
 *
 * If any features of this service require patching Module._resolveFilename,
 * then install our hook.  Logic within the hook conditionally implements
 * multiple resolver behaviors.
 */
export function installCommonjsResolveHookIfNecessary(tsNodeService: Service) {
  const Module = require('module') as ModuleConstructorWithInternals;
  const originalResolveFilename = Module._resolveFilename;
  const shouldInstallHook = tsNodeService.options.experimentalResolverFeatures;
  if (shouldInstallHook) {
    Module._resolveFilename = _resolveFilename;
  }
  function _resolveFilename(
    this: any,
    request: string,
    parent?: Module,
    isMain?: boolean,
    options?: ModuleResolveFilenameOptions,
    ...rest: any[]
  ): string {
    function defer(this: any) {
      return originalResolveFilename.call(
        this,
        request,
        parent,
        isMain,
        options,
        ...rest
      );
    }
    if (!tsNodeService.enabled())
      return defer();

    // Map from emit to source extensions
    if (!isMain && canReplaceJsWithTsExt(tsNodeService, request, parent?.filename)) {
      try {
        return originalResolveFilename.call(
          this,
          request.slice(0, -3),
          parent, isMain, options, ...rest
        );
      } catch (e) {
        const mainFile = defer();
        if (mainFile.endsWith('.js')) {
          //re-resolve with configured extension preference
          return originalResolveFilename.call(
            this,
            mainFile.slice(0, -3),
            parent, isMain, options, ...rest
          );
        }
        return mainFile;
      }
    }
    // This is a stub to support other pull requests that will be merged in the near future
    // Right now, it does nothing.
    return defer();
  }
}

function canReplaceJsWithTsExt(service: Service, request: string, parentPath?: string) {
  if (!parentPath || service.ignored(parentPath)) return false;
  if (isRelativeSpecifier(request) && request.slice(-3) === '.js') {
    if (!parentPath) return true;
    const paths = require.main?.paths || [];
    // This logic is intending to exclude node_modules
    for (let i = 0; i < paths.length; i++) {
      if (parentPath.startsWith(paths[i])) {
        return false;
      }
    }
    return true;
  }
}
