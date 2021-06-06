import {existsSync, readFileSync, statSync, writeFileSync} from 'fs';
import type * as ts from 'typescript';
import type * as swcWasm from '@swc/wasm';
import type * as swcTypes from '@swc/core';
import type { CreateTranspilerOptions, TranspileOutput, Transpiler } from './types';
import { createCache } from '../cache';

export interface SwcTranspilerOptions extends CreateTranspilerOptions {
  /**
   * swc compiler to use for compilation
   * Set to '@swc/wasm' to use swc's WASM compiler
   * Default: '@swc/core', falling back to '@swc/wasm'
   */
  swc?: string | typeof swcWasm;
}

export function create(createOptions: SwcTranspilerOptions): Transpiler {
  const {
    swc,
    service: { config },
  } = createOptions;

  // Load swc compiler
  let swcInstance: typeof swcWasm;
  if (typeof swc === 'string') {
    swcInstance = require(swc) as typeof swcWasm;
  } else if (swc == null) {
    let swcResolved;
    try {
      swcResolved = require.resolve('@swc/core');
    } catch (e) {
      try {
        swcResolved = require.resolve('@swc/wasm');
      } catch (e) {
        throw new Error(
          'swc compiler requires either @swc/core or @swc/wasm to be installed as dependencies'
        );
      }
    }
    swcInstance = require(swcResolved) as typeof swcWasm;
  } else {
    swcInstance = swc;
  }

  // Prepare SWC options derived from typescript compiler options
  const compilerOptions = config.options;
  const {
    esModuleInterop,
    sourceMap,
    importHelpers,
    experimentalDecorators,
    emitDecoratorMetadata,
    target,
    jsxFactory,
    jsxFragmentFactory,
  } = compilerOptions;
  const nonTsxOptions = createSwcOptions(false);
  const tsxOptions = createSwcOptions(true);
  function createSwcOptions(isTsx: boolean): swcTypes.Options {
    const swcTarget = targetMapping.get(target!) ?? 'es3';
    const keepClassNames = target! >= /* ts.ScriptTarget.ES2016 */ 3;
    return {
      sourceMaps: sourceMap,
      // isModule: true,
      module: {
        type: 'commonjs',
        noInterop: !esModuleInterop,
      },
      swcrc: false,
      jsc: {
        externalHelpers: importHelpers,
        parser: {
          syntax: 'typescript',
          tsx: isTsx,
          decorators: experimentalDecorators,
          dynamicImport: true,
        },
        target: swcTarget,
        transform: {
          decoratorMetadata: emitDecoratorMetadata,
          legacyDecorator: true,
          react: {
            throwIfNamespace: false,
            development: false,
            useBuiltins: false,
            pragma: jsxFactory!,
            pragmaFrag: jsxFragmentFactory!,
          } as swcTypes.ReactConfig,
        },
        keepClassNames,
      } as swcTypes.JscConfig,
    };
  }

  const transpile: Transpiler['transpile'] = (input, transpileOptions) => {
    const { fileName } = transpileOptions;
    const cacheEntry = cacheApi.getEntry(rootCacheNode, fileName);
    let hash = input;
    try {
      hash = `${+statSync(fileName).mtime}`;
    } catch {}
    if(cacheEntry && cacheEntry.hash === hash) return cacheEntry.value;

    const swcOptions =
      fileName.endsWith('.tsx') || fileName.endsWith('.jsx')
        ? tsxOptions
        : nonTsxOptions;
    const { code, map } = swcInstance.transformSync(input, {
      ...swcOptions,
      filename: fileName,
    });
    const result = { outputText: code, sourceMapText: map };
    cacheApi.setEntry(rootCacheNode, fileName, {hash, value: result});
    return result;
  };

  interface CacheEntry {
    hash: string;
    value: {
      outputText: string;
      sourceMapText: string;
    }
  }

  const cachePath = './swc-cache.json';
  const cacheApi = createCache<CacheEntry>(existsSync(cachePath) ? readFileSync(cachePath, 'utf16le') : undefined);
  const rootCacheNode = cacheApi.getOrCreateSubcache(cacheApi.getRoot(), 'TODO build a hash of versions and config');
  cacheApi.registerCallbackOnProcessExitAndDirty(() => {
    writeFileSync(cachePath, cacheApi.serializeToString(), 'utf16le');
  });

  return {
    transpile,
  };
}

const targetMapping = new Map<ts.ScriptTarget, swcTypes.JscTarget>();
targetMapping.set(/* ts.ScriptTarget.ES3 */ 0, 'es3');
targetMapping.set(/* ts.ScriptTarget.ES5 */ 1, 'es5');
targetMapping.set(/* ts.ScriptTarget.ES2015 */ 2, 'es2015');
targetMapping.set(/* ts.ScriptTarget.ES2016 */ 3, 'es2016');
targetMapping.set(/* ts.ScriptTarget.ES2017 */ 4, 'es2017');
targetMapping.set(/* ts.ScriptTarget.ES2018 */ 5, 'es2018');
targetMapping.set(/* ts.ScriptTarget.ES2019 */ 6, 'es2019');
targetMapping.set(/* ts.ScriptTarget.ES2020 */ 7, 'es2019');
targetMapping.set(/* ts.ScriptTarget.ESNext */ 99, 'es2019');
