import type * as ts from 'typescript'
import * as swc from '@swc/core'

export const version = `${ require('../../package').version }-TODO-APPEND-TS-VERSION`

export const transpileModule: typeof ts.transpileModule = (input: string, transpileOptions: ts.TranspileOptions): ts.TranspileOutput => {
  const compilerOptions = transpileOptions.compilerOptions!
  const { fileName } = transpileOptions
  const { esModuleInterop, sourceMap, importHelpers, experimentalDecorators, emitDecoratorMetadata, target, jsxFactory, jsxFragmentFactory } = compilerOptions
  const { code, map } = swc.transformSync(input, {
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
  })
  return { outputText: code, sourceMapText: map }
}

const targetMapping = new Map<ts.ScriptTarget, swc.JscTarget>()
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
