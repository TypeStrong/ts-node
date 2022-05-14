import type Module = require('module');
import type { Service } from '.';

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
  _findPath(request: string, paths: string[], isMain: boolean): string;
};

interface ModuleResolveFilenameOptions {
  paths?: Array<string>;
}

/**
 * @internal
 */
export function installCommonjsResolveHooksIfNecessary(tsNodeService: Service) {
  const Module = require('module') as ModuleConstructorWithInternals;
  const originalResolveFilename = Module._resolveFilename;
  const shouldInstallHook = tsNodeService.options.experimentalResolver;
  if (shouldInstallHook) {
    Module._resolveFilename = _resolveFilename;
    Module._findPath = tsNodeService.getNodeCjsLoader().Module_findPath;
  }
  function _resolveFilename(
    this: any,
    request: string,
    parent?: Module,
    isMain?: boolean,
    options?: ModuleResolveFilenameOptions,
    ...rest: any[]
  ): string {
    if (!tsNodeService.enabled())
      return originalResolveFilename.call(
        this,
        request,
        parent,
        isMain,
        options,
        ...rest
      );

    // This is a stub to support other pull requests that will be merged in the near future
    // Right now, it does nothing.
    return originalResolveFilename.call(
      this,
      request,
      parent,
      isMain,
      options,
      ...rest
    );
  }
}
