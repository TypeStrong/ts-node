import type * as ts from 'typescript';
import { Service } from '..';

/**
 * Third-party transpilers are implemented as a CommonJS module with a
 * named export "create"
 */
export interface TranspilerModule {
  create: TranspilerFactory;
}
/**
 * Called by ts-node to create a custom transpiler.
 */
export type TranspilerFactory = (
  options: CreateTranspilerOptions
) => Transpiler;
export interface CreateTranspilerOptions {
  // TODO this is confusing because its only a partial Service.  Rename?
  service: Pick<Service, 'config' | 'options'>;
}
export interface Transpiler {
  // TODOs
  // Create spec for returning diagnostics?  Currently transpilers are allowed to
  // throw an error but that's it.
  transpile(input: string, options: TranspileOptions): TranspileOutput;
}
export interface TranspileOptions {
  fileName: string;
}
export interface TranspileOutput {
  outputText: string;
  diagnostics?: ts.Diagnostic[];
  sourceMapText?: string;
}
