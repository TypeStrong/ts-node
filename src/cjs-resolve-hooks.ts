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
  const originalFindPath = Module._findPath;
  const shouldInstallHook = tsNodeService.options.experimentalResolver;
  if (shouldInstallHook) {
    const { Module_findPath, Module_resolveFilename } = tsNodeService.getNodeCjsLoader();
    Module._resolveFilename = _resolveFilename;
    Module._findPath = _findPath;
    function _resolveFilename(
      this: any,
      request: string,
      parent?: Module,
      isMain?: boolean,
      options?: ModuleResolveFilenameOptions,
      ...rest: []
    ): string {
      if (!tsNodeService.enabled())
        return originalResolveFilename.call(this, request, parent, isMain, options, ...rest);

      return Module_resolveFilename.call(this, request, parent, isMain, options, ...rest);
    }
    function _findPath(this: any): string {
      if (!tsNodeService.enabled()) return originalFindPath.apply(this, arguments as any);
      return Module_findPath.apply(this, arguments as any);
    }
  }
}
