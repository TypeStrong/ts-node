/*
 * NOTE this script is meant to be run very rarely,
 * to help patch missing compilerOptions into the tsconfig schema.
 * The TS team updates it manually and sometimes forget to
 * add new options to the schema.
 * For example, here is the first PR I sent after running this script:
 * https://github.com/SchemaStore/schemastore/pull/1168
 *
 * This script adds some options that should *not* be in the schema,
 * so the output requires manual review.
 * There is no good, programmatic way to query the TypeScript API
 * for a list of all tsconfig options.
 *
 * TypeScript-Website has a database of rules; maybe we can use them in the future:
 * https://github.com/microsoft/TypeScript-Website/blob/v2/packages/tsconfig-reference/scripts/tsconfigRules.ts
 *
 * Dependencies of this script have deliberately not
 * been added to package.json.  You can install them locally
 * only when needed to run this script.
 *
 * This script is not strictly related to ts-node, so
 * theoretically it should be extracted to somewhere else
 * in the TypeStrong org.
 */

import {} from 'ts-expose-internals';
import * as ts from 'typescript';
import { getSchemastoreSchema } from './create-merged-schema';

// Sometimes schemastore becomes out of date with the latest tsconfig options.
// This script

async function main() {
  const schemastoreSchema = await getSchemastoreSchema();
  const compilerOptions = schemastoreSchema.definitions.compilerOptionsDefinition.properties.compilerOptions.properties;

  // These options are only available via CLI flags, not in a tsconfig file.
  const excludedOptions = [
    'help',
    'all',
    'version',
    'init',
    'project',
    'build',
    'showConfig',
    'generateCpuProfile', // <- technically gets parsed, but doesn't seem to do anything?
    'locale',
    'out', // <-- deprecated
  ];

  ts.optionDeclarations.forEach((v) => {
    if (excludedOptions.includes(v.name)) return;

    if (!compilerOptions[v.name]) {
      compilerOptions[v.name] = {
        description: v.description?.message,
        type: v.type,
      };
    }
  });

  // Don't write to a file; this is not part of our build process
  console.log(JSON.stringify(schemastoreSchema, null, 2));
}

main();
