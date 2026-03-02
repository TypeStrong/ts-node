import type { TsConfigOptions } from './index';

/*
 * This interface exists solely for generating a JSON schema for tsconfig.json.
 * We do *not* extend the compiler's tsconfig interface.  Instead we handle that
 * on a schema level, via "allOf", so we pull in the same schema that VSCode
 * already uses.
 */
/**
 * tsconfig schema which includes "ts-node" options.
 * @allOf [{"$ref": "https://schemastore.azurewebsites.net/schemas/json/tsconfig.json"}]
 */
export interface TsConfigSchema {
  /**
   * ts-node options.  See also: https://typestrong.org/ts-node/docs/configuration
   *
   * ts-node offers TypeScript execution and REPL for node.js, with source map support.
   */
  'ts-node': TsConfigOptions;
}
