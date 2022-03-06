import type * as ts from 'typescript';
import type { Service } from '../index';
import type { ProjectLocalResolveHelper } from '../util';

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
  // Careful: must avoid stripInternal breakage by guarding with Extract<>
  service: Pick<
    Service,
    Extract<'config' | 'options' | 'projectLocalResolveHelper', keyof Service>
  >;
  /**
   * If `"transpiler"` option is declared in an "extends" tsconfig, this path might be different than
   * the `projectLocalResolveHelper`
   *
   * @internal
   */
  transpilerConfigLocalResolveHelper: ProjectLocalResolveHelper;
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
