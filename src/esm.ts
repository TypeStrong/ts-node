import { register, RegisterOptions, Service } from './index';
import { parse as parseUrl, format as formatUrl, UrlWithStringQuery, fileURLToPath, pathToFileURL } from 'url';
import { extname, resolve as pathResolve } from 'path';
import * as assert from 'assert';
import { normalizeSlashes, versionGteLt } from './util';
import { createRequire } from 'module';

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
  ) => Promise<{
    url: string;
    format?: NodeLoaderHooksFormat;
    shortCircuit?: boolean;
  }>;
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
    shortCircuit?: boolean;
  }>;
  export type NodeImportConditions = unknown;
  export interface NodeImportAssertions {
    type?: 'json';
  }
}

export type NodeLoaderHooksFormat = 'builtin' | 'commonjs' | 'dynamic' | 'json' | 'module' | 'wasm';

export type NodeImportConditions = unknown;
export interface NodeImportAssertions {
  type?: 'json';
}

// The hooks API changed in node version X so we need to check for backwards compatibility.
const newHooksAPI = versionGteLt(process.versions.node, '16.12.0');

/** @internal */
export function filterHooksByAPIVersion(
  hooks: NodeLoaderHooksAPI1 & NodeLoaderHooksAPI2
): NodeLoaderHooksAPI1 | NodeLoaderHooksAPI2 {
  const { getFormat, load, resolve, transformSource } = hooks;
  // Explicit return type to avoid TS's non-ideal inferred type
  const hooksAPI: NodeLoaderHooksAPI1 | NodeLoaderHooksAPI2 = newHooksAPI
    ? { resolve, load, getFormat: undefined, transformSource: undefined }
    : { resolve, getFormat, transformSource, load: undefined };
  return hooksAPI;
}

/** @internal */
export function registerAndCreateEsmHooks(opts?: RegisterOptions) {
  // Automatically performs registration just like `-r ts-node/register`
  const tsNodeInstance = register(opts);

  return createEsmHooks(tsNodeInstance);
}

export function createEsmHooks(tsNodeService: Service) {
  // Custom implementation that considers additional file extensions and automatically adds file extensions
  const nodeResolveImplementation = tsNodeService.getNodeEsmResolver();
  const nodeGetFormatImplementation = tsNodeService.getNodeEsmGetFormat();
  const extensions = tsNodeService.extensions;

  const hooksAPI = filterHooksByAPIVersion({
    resolve,
    load,
    getFormat,
    transformSource,
  });

  function isFileUrlOrNodeStyleSpecifier(parsed: UrlWithStringQuery) {
    // We only understand file:// URLs, but in node, the specifier can be a node-style `./foo` or `foo`
    const { protocol } = parsed;
    return protocol === null || protocol === 'file:';
  }

  const runMainHackUrl = pathToFileURL(pathResolve(__dirname, '../dist-raw/runmain-hack.js')).toString();

  /**
   * Named "probably" as a reminder that this is a guess.
   * node does not explicitly tell us if we're resolving the entrypoint or not.
   */
  function isProbablyEntrypoint(specifier: string, parentURL: string) {
    return (parentURL === undefined || parentURL === runMainHackUrl) && specifier.startsWith('file://');
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
      cb: () => ReturnType<typeof resolve> | Awaited<ReturnType<typeof resolve>>
    ): ReturnType<typeof resolve> {
      try {
        const resolution = await cb();
        if (resolution?.url && isProbablyEntrypoint(specifier, context.parentURL))
          rememberIsProbablyEntrypoint.add(resolution.url);
        return resolution;
      } catch (esmResolverError) {
        if (!isProbablyEntrypoint(specifier, context.parentURL)) throw esmResolverError;
        try {
          let cjsSpecifier = specifier;
          // Attempt to convert from ESM file:// to CommonJS path
          try {
            if (specifier.startsWith('file://')) cjsSpecifier = fileURLToPath(specifier);
          } catch {}
          const resolution = pathToFileURL(createRequire(process.cwd()).resolve(cjsSpecifier)).toString();
          rememberIsProbablyEntrypoint.add(resolution);
          rememberResolvedViaCommonjsFallback.add(resolution);
          return { url: resolution, format: 'commonjs' };
        } catch (commonjsResolverError) {
          throw esmResolverError;
        }
      }
    }

    return addShortCircuitFlag(async () => {
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

      // pathname is the path to be resolved

      return entrypointFallback(() => nodeResolveImplementation.defaultResolve(specifier, context, defaultResolve));
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
    return addShortCircuitFlag(async () => {
      // If we get a format hint from resolve() on the context then use it
      // otherwise call the old getFormat() hook using node's old built-in defaultGetFormat() that ships with ts-node
      const format =
        context.format ?? (await getFormat(url, context, nodeGetFormatImplementation.defaultGetFormat)).format;

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
          throw new Error(`Failed to load raw source: Format was '${format}' and url was '${url}''.`);
        }

        // Emulate node's built-in old defaultTransformSource() so we can re-use the old transformSource() hook
        const defaultTransformSource: typeof transformSource = async (source, _context, _defaultTransformSource) => ({
          source,
        });

        // Call the old hook
        const { source: transformedSource } = await transformSource(rawSource, { url, format }, defaultTransformSource);
        source = transformedSource;
      }

      return { format, source };
    });
  }

  async function getFormat(
    url: string,
    context: {},
    defaultGetFormat: typeof getFormat
  ): Promise<{ format: NodeLoaderHooksFormat }> {
    const defer = (overrideUrl: string = url) => defaultGetFormat(overrideUrl, context, defaultGetFormat);

    // See: https://github.com/nodejs/node/discussions/41711
    // nodejs will likely implement a similar fallback.  Till then, we can do our users a favor and fallback today.
    async function entrypointFallback(cb: () => ReturnType<typeof getFormat>): ReturnType<typeof getFormat> {
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
    assert(pathname !== null, 'ESM getFormat() hook: URL should never have null pathname');

    const nativePath = fileURLToPath(url);

    let nodeSays: { format: NodeLoaderHooksFormat };

    // If file has extension not understood by node, then ask node how it would treat the emitted extension.
    // E.g. .mts compiles to .mjs, so ask node how to classify an .mjs file.
    const ext = extname(nativePath);
    const tsNodeIgnored = tsNodeService.ignored(nativePath);
    const nodeEquivalentExt = extensions.nodeEquivalents.get(ext);
    if (nodeEquivalentExt && !tsNodeIgnored) {
      nodeSays = await entrypointFallback(() => defer(formatUrl(pathToFileURL(nativePath + nodeEquivalentExt))));
    } else {
      try {
        nodeSays = await entrypointFallback(defer);
      } catch (e) {
        if (e instanceof Error && tsNodeIgnored && extensions.nodeDoesNotUnderstand.includes(ext)) {
          e.message +=
            `\n\n` +
            `Hint:\n` +
            `ts-node is configured to ignore this file.\n` +
            `If you want ts-node to handle this file, consider enabling the "skipIgnore" option or adjusting your "ignore" patterns.\n` +
            `https://typestrong.org/ts-node/docs/scope\n`;
        }
        throw e;
      }
    }
    // For files compiled by ts-node that node believes are either CJS or ESM, check if we should override that classification
    if (!tsNodeService.ignored(nativePath) && (nodeSays.format === 'commonjs' || nodeSays.format === 'module')) {
      const { moduleType } = tsNodeService.moduleTypeClassifier.classifyModuleByModuleTypeOverrides(
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

    const defer = () => defaultTransformSource(source, context, defaultTransformSource);

    const sourceAsString = typeof source === 'string' ? source : source.toString('utf8');

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

async function addShortCircuitFlag<T>(fn: () => Promise<T>) {
  const ret = await fn();
  // Not sure if this is necessary; being lazy.  Can revisit in the future.
  if (ret == null) return ret;
  return {
    ...ret,
    shortCircuit: true,
  };
}
