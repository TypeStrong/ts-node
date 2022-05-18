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
    const { Module_findPath, Module_resolveFilename } =
      tsNodeService.getNodeCjsLoader();
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
        return originalResolveFilename.call(
          this,
          request,
          parent,
          isMain,
          options,
          ...rest
        );

      // #region path-mapping
      // Note: [SYNC-PATH-MAPPING] keep this logic synced with the corresponding ESM implementation.
      let candidateSpecifiers: string[] = [request];
      const attemptPathMapping =
        tsNodeService.commonjsPathMapping &&
        parent?.filename &&
        !tsNodeService.ignored(parent.filename);
      if (attemptPathMapping) {
        const mappedSpecifiers = tsNodeService.mapPath(request);
        if (mappedSpecifiers) {
          candidateSpecifiers = [...mappedSpecifiers, request];
        }
      }
      // Attempt all resolutions.  Collect resolution failures and throw an
      // aggregated error if they all fail.
      const moduleNotFoundErrors = [];
      for (let i = 0; i < candidateSpecifiers.length; i++) {
        try {
          // TODO does this break if `options.paths` is passed?  Should we bail if
          // we receive `options.paths`?
          return Module_resolveFilename.call(
            this,
            candidateSpecifiers[i],
            parent,
            isMain,
            options
          );
        } catch (err: any) {
          const isNotFoundError = err.code === 'MODULE_NOT_FOUND';
          if (!isNotFoundError) {
            throw err;
          }
          moduleNotFoundErrors.push(err);
        }
      }
      // If only one candidate, no need to wrap it.
      if (candidateSpecifiers.length === 1) {
        throw moduleNotFoundErrors[0];
      } else {
        throw new MappedCommonJSModuleNotFoundError(
          request,
          parent!.filename,
          candidateSpecifiers,
          moduleNotFoundErrors
        );
      }
      // #endregion
    }

    function _findPath(this: any): string {
      if (!tsNodeService.enabled())
        return originalFindPath.apply(this, arguments as any);
      return Module_findPath.apply(this, arguments as any);
    }
  }
}

interface NodeCommonJSModuleNotFoundError extends Error {
  requireStack?: string[];
}

class MappedCommonJSModuleNotFoundError extends Error {
  // Same code as other module not found errors.
  readonly code = 'MODULE_NOT_FOUND' as const;
  readonly errors!: ReadonlyArray<Error>;
  readonly requireStack?: string[];

  constructor(
    specifier: string,
    parentFilename: string,
    candidates: string[],
    moduleNotFoundErrors: Error[]
  ) {
    super(
      [
        `Cannot find '${specifier}' imported from ${parentFilename} using TypeScript path mapping`,
        'Candidates attempted:',
        ...candidates.map((candidate) => `- ${candidate}`),
      ].join('\n')
    );
    // TODO this differs slightly from nodejs errors; see if we can match them
    this.name = `Error [${this.code}]`;
    // Match shape of `AggregateError`
    Object.defineProperty(this, 'errors', {
      value: moduleNotFoundErrors,
      configurable: true,
      writable: true,
    });
    // Assume every `requireStack` is identical, and maybe downstream code is doing
    // something with it
    this.requireStack = (
      moduleNotFoundErrors[0] as NodeCommonJSModuleNotFoundError | undefined
    )?.requireStack;
  }
}
