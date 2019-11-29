#!/usr/bin/env ts-node
/*
 * Create a complete JSON schema for tsconfig.json
 * by merging the schemastore schema with our ts-node additions.
 * This merged schema can be submitted in a pull request to
 * SchemaStore.
 */

import axios from 'axios';
import * as Path from 'path';
import * as fs from 'fs';

async function main() {
  /** schemastore definition */
  const schemastoreSchema = (await axios.get(
    'https://schemastore.azurewebsites.net/schemas/json/tsconfig.json',
    { responseType: "json" }
  )).data;

  /** ts-node schema auto-generated from ts-node source code */
  const typescriptNodeSchema = require('../tsconfig.schema.json');

  /** Patch ts-node stuff into the schemastore definition. */
  const mergedSchema = {
    ...schemastoreSchema,
    definitions: {
      ...schemastoreSchema.definitions,
      tsNodeDefinition: {
        properties: {
          'ts-node': {
            ...typescriptNodeSchema.definitions.TsConfigOptions,
            description: typescriptNodeSchema.definitions.TsConfigSchema.properties['ts-node'].description,
            properties: {
              ...typescriptNodeSchema.definitions.TsConfigOptions.properties,
              compilerOptions: {
                ...typescriptNodeSchema.definitions.TsConfigOptions.properties.compilerOptions,
                allOf: [{
                  $ref: '#/definitions/compilerOptionsDefinition/properties/compilerOptions'
                }]
              }
            }
          }
        }
      },
    },
    allOf: [
      ...schemastoreSchema.allOf.slice(0, 4),
      { "$ref": "#/definitions/tsNodeDefinition" },
      ...schemastoreSchema.allOf.slice(4),
    ]
  };
  fs.writeFileSync(
    Path.resolve(__dirname, '../tsconfig.schemastore-schema.json'),
    JSON.stringify(mergedSchema, null, 2)
  );
}

main();
