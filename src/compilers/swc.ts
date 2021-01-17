import type * as ts from 'typescript'
import type * as swcWasm from '@swc/wasm'
import type * as swcTypes from '@swc/core'
import type { TSCommon } from '..'
export interface Options {
  /** TypeScript compiler to wrap */
  compiler?: string | TSCommon
  /**
   * swc compiler to use for compilation
   * Set to '@swc/wasm' to use swc's WASM compiler
   * Default: '@swc/core'
   */
  swc?: string | typeof swcWasm
}

export function createTypeScriptCompiler (options: Options = {}) {
  const { swc, compiler = 'typescript' } = options
  const compilerInstance = typeof compiler === 'string' ? require(compiler) as TSCommon : compiler
  let swcInstance: typeof swcWasm
  if (typeof swc === 'string') {
    swcInstance = require(swc) as typeof swcWasm
  } else if (swc == null) { // tslint:disable-line
    let swcResolved
    try {
      swcResolved = require.resolve('@swc/core')
    } catch (e) {
      try {
        swcResolved = require.resolve('@swc/wasm')
      } catch (e) {
        throw new Error('swc compiler requires either @swc/core or @swc/wasm to be installed as dependencies')
      }
    }
    swcInstance = require(swcResolved) as typeof swcWasm
  } else {
    swcInstance = swc
  }

  const version = `${ compilerInstance.version }-tsnode-${ require('../../package').version }-swc`

  const transpileModule: TSCommon['transpileModule'] = (input: string, transpileOptions: ts.TranspileOptions): ts.TranspileOutput => {
    const compilerOptions = transpileOptions.compilerOptions!
    const { fileName } = transpileOptions
    const { esModuleInterop, sourceMap, importHelpers, experimentalDecorators, emitDecoratorMetadata, target, jsxFactory, jsxFragmentFactory } = compilerOptions
    const options: swcTypes.Options = {
      filename: fileName,
      sourceMaps: sourceMap,
      // isModule: true,
      module: {
        type: 'commonjs',
        noInterop: !esModuleInterop
      },
      swcrc: false,
      jsc: {
        externalHelpers: importHelpers,
        parser: {
          syntax: 'typescript',
          tsx: fileName!.endsWith('.tsx') || fileName!.endsWith('.jsx'),
          decorators: experimentalDecorators,
          dynamicImport: true
        },
        target: targetMapping.get(target!) ?? 'es3',
        transform: {
          decoratorMetadata: emitDecoratorMetadata,
          legacyDecorator: true,
          react: {
            throwIfNamespace: false,
            development: false,
            useBuiltins: false,
            pragma: jsxFactory!,
            pragmaFrag: jsxFragmentFactory!
          }
        }
      }
    }
    const { code, map } = swcInstance.transformSync(input, options)
    return { outputText: code, sourceMapText: map }
  }
  return {
    ...compilerInstance,
    version,
    transpileModule
  }
}

const targetMapping = new Map<ts.ScriptTarget, swcTypes.JscTarget>()
targetMapping.set(/* ts.ScriptTarget.ES3 */ 0, 'es3')
targetMapping.set(/* ts.ScriptTarget.ES5 */ 1, 'es5')
targetMapping.set(/* ts.ScriptTarget.ES2015 */ 2, 'es2015')
targetMapping.set(/* ts.ScriptTarget.ES2016 */ 3, 'es2016')
targetMapping.set(/* ts.ScriptTarget.ES2017 */ 4, 'es2017')
targetMapping.set(/* ts.ScriptTarget.ES2018 */ 5, 'es2018')
targetMapping.set(/* ts.ScriptTarget.ES2019 */ 6, 'es2019')
targetMapping.set(/* ts.ScriptTarget.ES2020 */ 7, 'es2019')
targetMapping.set(/* ts.ScriptTarget.ESNext */ 99, 'es2019')
targetMapping.set(/* ts.ScriptTarget.Latest */ 99, 'es2019')
