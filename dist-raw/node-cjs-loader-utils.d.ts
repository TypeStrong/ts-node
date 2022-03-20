export function assertScriptCanLoadAsCJSImpl(
  service: import('../src/index').Service,
  module: NodeJS.Module,
  filename: string
): void;

export function readPackageScope(checkPath: string): PackageScope | false;

export interface PackageScope {
  path: string,
  data: {
    name: string,
    main?: string,
    exports?: object,
    imports?: object,
    type?: string
  }
}
