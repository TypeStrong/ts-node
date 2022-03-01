import {
  register,
  getExtensions,
  RegisterOptions,
  Service,
  versionGteLt,
} from './index';
import {
  parse as parseUrl,
  format as formatUrl,
  UrlWithStringQuery,
  fileURLToPath,
  pathToFileURL,
  URL,
} from 'url';
import { extname } from 'path';
import * as assert from 'assert';
import { normalizeSlashes } from './util';
import { createRequire } from 'module';
const {
  createResolve,
} = require('../dist-raw/node-esm-resolve-implementation');
const { defaultGetFormat } = require('../dist-raw/node-esm-default-get-format');

// Note: On Windows, URLs look like this: file:///D:/dev/@TypeStrong/ts-node-examples/foo.ts

// NOTE ABOUT MULTIPLE EXPERIMENTAL LOADER APIS
//
// At the time of writing, this file implements 2x different loader APIs.
// Node made a breaking change to the loader API in https://github.com/nodejs/node/pull/37468
//
// We check the node version number and export either the *old* or the *new* API.
//
// Today, we are implementing the *new* API on top of our implementation of the *old* API,
// which relies on copy-pasted code from the *old* hooks implementation in node.
//
// In the future, we will likely invert this: we will copy-paste the *new* API implementation
// from node, build our implementation of the *new* API on top of it, and implement the *old*
// hooks API as a shim to the *new* API.

export interface NodeLoaderHooksAPI1 {
  resolve: NodeLoaderHooksAPI1.ResolveHook;
  getFormat: NodeLoaderHooksAPI1.GetFormatHook;
  transformSource: NodeLoaderHooksAPI1.TransformSourceHook;
}
export namespace NodeLoaderHooksAPI1 {
  export type ResolveHook = NodeLoaderHooksAPI2.ResolveHook;
  export type GetFormatHook = (
    url: string,
    context: {},
    defaultGetFormat: GetFormatHook
  ) => Promise<{ format: NodeLoaderHooksFormat }>;
  export type TransformSourceHook = (
    source: string | Buffer,
    context: { url: string; format: NodeLoaderHooksFormat },
    defaultTransformSource: NodeLoaderHooksAPI1.TransformSourceHook
  ) => Promise<{ source: string | Buffer }>;
}

export interface NodeLoaderHooksAPI2 {
  resolve: NodeLoaderHooksAPI2.ResolveHook;
  load: NodeLoaderHooksAPI2.LoadHook;
}
export namespace NodeLoaderHooksAPI2 {
  export type ResolveHook = (
    specifier: string,
    context: {
      conditions?: NodeImportConditions;
      importAssertions?: NodeImportAssertions;
      parentURL: string;
    },
    defaultResolve: ResolveHook
  ) => Promise<{ url: string; format?: NodeLoaderHooksFormat }>;
  export type LoadHook = (
    url: string,
    context: {
      format: NodeLoaderHooksFormat | null | undefined;
      importAssertions?: NodeImportAssertions;
    },
    defaultLoad: NodeLoaderHooksAPI2['load']
  ) => Promise<{
    format: NodeLoaderHooksFormat;
    source: string | Buffer | undefined;
  }>;
  export type NodeImportConditions = unknown;
  export interface NodeImportAssertions {
    type?: 'json';
  }
}

export type NodeLoaderHooksFormat =
  | 'builtin'
  | 'commonjs'
  | 'dynamic'
  | 'json'
  | 'module'
  | 'wasm';

/** @internal */
export function registerAndCreateEsmHooks(opts?: RegisterOptions) {
  // Automatically performs registration just like `-r ts-node/register`
  const tsNodeInstance = register(opts);

  return createEsmHooks(tsNodeInstance);
}

export function createEsmHooks(tsNodeService: Service) {
  tsNodeService.enableExperimentalEsmLoaderInterop();

  // Custom implementation that considers additional file extensions and automatically adds file extensions
  const nodeResolveImplementation = createResolve({
    ...getExtensions(tsNodeService.config),
    preferTsExts: tsNodeService.options.preferTsExts,
  });

  // The hooks API changed in node version X so we need to check for backwards compatibility.
  // TODO: When the new API is backported to v12, v14, update these version checks accordingly.
  const newHooksAPI =
    versionGteLt(process.versions.node, '17.0.0') ||
    versionGteLt(process.versions.node, '16.12.0', '17.0.0') ||
    versionGteLt(process.versions.node, '14.999.999', '15.0.0') ||
    versionGteLt(process.versions.node, '12.999.999', '13.0.0');

  // Explicit return type to avoid TS's non-ideal inferred type
  const hooksAPI: NodeLoaderHooksAPI1 | NodeLoaderHooksAPI2 = newHooksAPI
    ? { resolve, load, getFormat: undefined, transformSource: undefined }
    : { resolve, getFormat, transformSource, load: undefined };

  function isFileUrlOrNodeStyleSpecifier(parsed: UrlWithStringQuery) {
    // We only understand file:// URLs, but in node, the specifier can be a node-style `./foo` or `foo`
    const { protocol } = parsed;
    return protocol === null || protocol === 'file:';
  }

  /**
   * Named "probably" as a reminder that this is a guess.
   * node does not explicitly tell us if we're resolving the entrypoint or not.
   */
  function isProbablyEntrypoint(specifier: string, parentURL: string) {
    return parentURL === undefined && specifier.startsWith('file://');
  }
  // Side-channel between `resolve()` and `load()` hooks
  const rememberIsProbablyEntrypoint = new Set();
  const rememberResolvedViaCommonjsFallback = new Set();

  async function resolve(
    specifier: string,
    context: { parentURL: string },
    defaultResolve: typeof resolve
  ): Promise<{ url: string; format?: NodeLoaderHooksFormat }> {
    const defer = async () => {
      const r = await defaultResolve(specifier, context, defaultResolve);
      return r;
    };
    // See: https://github.com/nodejs/node/discussions/41711
    // nodejs will likely implement a similar fallback.  Till then, we can do our users a favor and fallback today.
    async function entrypointFallback(
      cb: () => ReturnType<typeof resolve>
    ): ReturnType<typeof resolve> {
      try {
        const resolution = await cb();
        if (
          resolution?.url &&
          isProbablyEntrypoint(specifier, context.parentURL)
        )
          rememberIsProbablyEntrypoint.add(resolution.url);
        return resolution;
      } catch (esmResolverError) {
        if (!isProbablyEntrypoint(specifier, context.parentURL))
          throw esmResolverError;
        try {
          let cjsSpecifier = specifier;
          // Attempt to convert from ESM file:// to CommonJS path
          try {
            if (specifier.startsWith('file://'))
              cjsSpecifier = fileURLToPath(specifier);
          } catch {}
          const resolution = pathToFileURL(
            createRequire(process.cwd()).resolve(cjsSpecifier)
          ).toString();
          rememberIsProbablyEntrypoint.add(resolution);
          rememberResolvedViaCommonjsFallback.add(resolution);
          return { url: resolution, format: 'commonjs' };
        } catch (commonjsResolverError) {
          throw esmResolverError;
        }
      }
    }

    const parsed = parseUrl(specifier);
    const { pathname, protocol, hostname } = parsed;

    if (!isFileUrlOrNodeStyleSpecifier(parsed)) {
      return entrypointFallback(defer);
    }

    if (protocol !== null && protocol !== 'file:') {
      return entrypointFallback(defer);
    }

    // Malformed file:// URL?  We should always see `null` or `''`
    if (hostname) {
      // TODO file://./foo sets `hostname` to `'.'`.  Perhaps we should special-case this.
      return entrypointFallback(defer);
    }

    // Note: [SYNC-PATH-MAPPING] keep this logic synced with the corresponding CJS implementation.
    let candidateSpecifiers: string[] = [specifier];

    if (tsNodeService.esmPathMapping && context.parentURL) {
      const parentUrl = new URL(context.parentURL);
      const parentPath =
        parentUrl.protocol === 'file:' && fileURLToPath(parentUrl);
      if (parentPath && !tsNodeService.ignored(parentPath)) {
        const mappedSpecifiers = tsNodeService.mapPath(specifier);
        if (mappedSpecifiers) {
          candidateSpecifiers = [
            ...mappedSpecifiers.map((path) => pathToFileURL(path).toString()),
            specifier,
          ];
        }
      }
    }

    return entrypointFallback(async () => {
      // Attempt all resolutions.  Collect resolution failures and throw an
      // aggregated error if they all fail.
      const moduleNotFoundErrors = [];
      for (let i = 0; i < candidateSpecifiers.length; i++) {
        try {
          return await nodeResolveImplementation.defaultResolve(
            candidateSpecifiers[i],
            context,
            defaultResolve
          );
        } catch (err: any) {
          const isNotFoundError = err.code === 'ERR_MODULE_NOT_FOUND';
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
        throw new MappedModuleNotFoundError(
          specifier,
          context.parentURL,
          candidateSpecifiers,
          moduleNotFoundErrors
        );
      }
    });
  }

  // `load` from new loader hook API (See description at the top of this file)
  async function load(
    url: string,
    context: {
      format: NodeLoaderHooksFormat | null | undefined;
      importAssertions?: NodeLoaderHooksAPI2.NodeImportAssertions;
    },
    defaultLoad: typeof load
  ): Promise<{
    format: NodeLoaderHooksFormat;
    source: string | Buffer | undefined;
  }> {
    // If we get a format hint from resolve() on the context then use it
    // otherwise call the old getFormat() hook using node's old built-in defaultGetFormat() that ships with ts-node
    const format =
      context.format ??
      (await getFormat(url, context, defaultGetFormat)).format;

    let source = undefined;
    if (format !== 'builtin' && format !== 'commonjs') {
      // Call the new defaultLoad() to get the source
      const { source: rawSource } = await defaultLoad(
        url,
        {
          ...context,
          format,
        },
        defaultLoad
      );

      if (rawSource === undefined || rawSource === null) {
        throw new Error(
          `Failed to load raw source: Format was '${format}' and url was '${url}''.`
        );
      }

      // Emulate node's built-in old defaultTransformSource() so we can re-use the old transformSource() hook
      const defaultTransformSource: typeof transformSource = async (
        source,
        _context,
        _defaultTransformSource
      ) => ({ source });

      // Call the old hook
      const { source: transformedSource } = await transformSource(
        rawSource,
        { url, format },
        defaultTransformSource
      );
      source = transformedSource;
    }

    return { format, source };
  }

  async function getFormat(
    url: string,
    context: {},
    defaultGetFormat: typeof getFormat
  ): Promise<{ format: NodeLoaderHooksFormat }> {
    const defer = (overrideUrl: string = url) =>
      defaultGetFormat(overrideUrl, context, defaultGetFormat);

    // See: https://github.com/nodejs/node/discussions/41711
    // nodejs will likely implement a similar fallback.  Till then, we can do our users a favor and fallback today.
    async function entrypointFallback(
      cb: () => ReturnType<typeof getFormat>
    ): ReturnType<typeof getFormat> {
      try {
        return await cb();
      } catch (getFormatError) {
        if (!rememberIsProbablyEntrypoint.has(url)) throw getFormatError;
        return { format: 'commonjs' };
      }
    }

    const parsed = parseUrl(url);

    if (!isFileUrlOrNodeStyleSpecifier(parsed)) {
      return entrypointFallback(defer);
    }

    const { pathname } = parsed;
    assert(
      pathname !== null,
      'ESM getFormat() hook: URL should never have null pathname'
    );

    const nativePath = fileURLToPath(url);

    // If file has .ts, .tsx, or .jsx extension, then ask node how it would treat this file if it were .js
    const ext = extname(nativePath);
    let nodeSays: { format: NodeLoaderHooksFormat };
    if (ext !== '.js' && !tsNodeService.ignored(nativePath)) {
      nodeSays = await entrypointFallback(() =>
        defer(formatUrl(pathToFileURL(nativePath + '.js')))
      );
    } else {
      nodeSays = await entrypointFallback(defer);
    }
    // For files compiled by ts-node that node believes are either CJS or ESM, check if we should override that classification
    if (
      !tsNodeService.ignored(nativePath) &&
      (nodeSays.format === 'commonjs' || nodeSays.format === 'module')
    ) {
      const { moduleType } = tsNodeService.moduleTypeClassifier.classifyModule(
        normalizeSlashes(nativePath)
      );
      if (moduleType === 'cjs') {
        return { format: 'commonjs' };
      } else if (moduleType === 'esm') {
        return { format: 'module' };
      }
    }
    return nodeSays;
  }

  async function transformSource(
    source: string | Buffer,
    context: { url: string; format: NodeLoaderHooksFormat },
    defaultTransformSource: typeof transformSource
  ): Promise<{ source: string | Buffer }> {
    if (source === null || source === undefined) {
      throw new Error('No source');
    }

    const defer = () =>
      defaultTransformSource(source, context, defaultTransformSource);

    const sourceAsString =
      typeof source === 'string' ? source : source.toString('utf8');

    const { url } = context;
    const parsed = parseUrl(url);

    if (!isFileUrlOrNodeStyleSpecifier(parsed)) {
      return defer();
    }
    const nativePath = fileURLToPath(url);

    if (tsNodeService.ignored(nativePath)) {
      return defer();
    }

    const emittedJs = tsNodeService.compile(sourceAsString, nativePath);

    return { source: emittedJs };
  }

  return hooksAPI;
}

class MappedModuleNotFoundError extends Error {
  // Same code as other module not found errors.
  readonly code = 'ERR_MODULE_NOT_FOUND' as const;
  readonly errors!: ReadonlyArray<Error>;

  constructor(
    specifier: string,
    base: string,
    candidates: string[],
    moduleNotFoundErrors: Error[]
  ) {
    super(
      [
        `Cannot find '${specifier}' imported from ${base} using TypeScript path mapping`,
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
  }
}
