import { context } from './testlib';
import { contextTsNodeUnderTest, resetNodeEnvironment } from './helpers';
import * as expect from 'expect';
import { resolve } from 'path';

const test = context(contextTsNodeUnderTest);

test.suite(
  'Pluggable dependency (compiler, transpiler, swc backend) is require()d relative to the tsconfig file that declares it',
  (test) => {
    test.runSerially();

    // The use-case we want to support:
    //
    // User shares their tsconfig across multiple projects as an npm module named "shared-config", similar to @tsconfig/bases
    // In their npm module
    //     They have tsconfig.json with `swc: true` or `compiler: "ts-patch"` or something like that
    //     The module declares a dependency on a known working version of @swc/core, or ts-patch, or something like that.
    // They use this reusable config via `npm install shared-config` and `"extends": "shared-config/tsconfig.json"`
    //
    // ts-node should resolve ts-patch or @swc/core relative to the extended tsconfig
    // to ensure we use the known working versions.

    macro('tsconfig-custom-compiler.json', 'root custom compiler');
    macro('tsconfig-custom-transpiler.json', 'root custom transpiler');
    macro('tsconfig-swc-custom-backend.json', 'root custom swc backend');
    macro('tsconfig-swc-core.json', 'root @swc/core');
    macro('tsconfig-swc-wasm.json', 'root @swc/wasm');
    macro('tsconfig-swc.json', 'root @swc/core');

    macro('node_modules/shared-config/tsconfig-custom-compiler.json', 'shared-config custom compiler');
    macro('node_modules/shared-config/tsconfig-custom-transpiler.json', 'shared-config custom transpiler');
    macro('node_modules/shared-config/tsconfig-swc-custom-backend.json', 'shared-config custom swc backend');
    macro('node_modules/shared-config/tsconfig-swc-core.json', 'shared-config @swc/core');
    macro('node_modules/shared-config/tsconfig-swc-wasm.json', 'shared-config @swc/wasm');
    macro('node_modules/shared-config/tsconfig-swc.json', 'shared-config @swc/core');

    macro('tsconfig-extend-custom-compiler.json', 'shared-config custom compiler');
    macro('tsconfig-extend-custom-transpiler.json', 'shared-config custom transpiler');
    macro('tsconfig-extend-swc-custom-backend.json', 'shared-config custom swc backend');
    macro('tsconfig-extend-swc-core.json', 'shared-config @swc/core');
    macro('tsconfig-extend-swc-wasm.json', 'shared-config @swc/wasm');
    macro('tsconfig-extend-swc.json', 'shared-config @swc/core');

    function macro(config: string, expected: string) {
      test(`${config} uses ${expected}`, async (t) => {
        t.teardown(resetNodeEnvironment);

        const output = t.context.tsNodeUnderTest
          .create({
            project: resolve('tests/pluggable-dep-resolution', config),
          })
          .compile('', 'index.ts');

        expect(output).toContain(`emit from ${expected}\n`);
      });
    }
  }
);
