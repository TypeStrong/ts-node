import type * as ts from 'typescript'
import { Service } from '..'

export interface CreateTranspilerOptions {
  // TODO this is confusing because its only a partial Service.  Rename?
  service: Pick<Service, 'config' | 'options'>
}
export type TranspilerFactory = (options: CreateTranspilerOptions) => Transpiler
export interface TranspileOptions {
  fileName: string
}
export interface Transpiler {
  transpile (input: string, options: TranspileOptions): TranspileOutput
}
export interface TranspileOutput {
  outputText: string
  diagnostics?: ts.Diagnostic[]
  sourceMapText?: string
}
