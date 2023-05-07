import { context } from './testlib';
import { ctxTsNode, resetNodeEnvironment, TEST_DIR } from './helpers';
import * as expect from 'expect';
import { resolve } from 'path';

const test = context(ctxTsNode);

test.suite(
  'Pluggable dependency (compiler, transpiler, swc backend) is require()d relative to the tsconfig file that declares it',
  (test) => {
    test.serial();

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

    const macro = test.macro((config: string, expected: string) => [
      `${config} uses ${expected}`,
      async (t) => {
        t.teardown(resetNodeEnvironment);

        // A bit hacky: we've monkey-patched the various dependencies to either:
        // a) return transpiled output we expect
        // b) throw an error that we expect
        // Either way, we've proven that the correct dependency is used, which
        // is our goal.
        let output: string;
        try {
          output = t.context.tsNodeUnderTest
            .create({
              project: resolve(TEST_DIR, 'pluggable-dep-resolution', config),
            })
            .compile('', 'index.ts');
        } catch (e) {
          expect(e).toBe(`emit from ${expected}`);
          return;
        }

        expect(output).toContain(`emit from ${expected}\n`);
      },
    ]);

    test(macro, 'tsconfig-custom-compiler.json', 'root custom compiler');
    test(macro, 'tsconfig-custom-transpiler.json', 'root custom transpiler');
    test(macro, 'tsconfig-swc-custom-backend.json', 'root custom swc backend');
    test(macro, 'tsconfig-swc-core.json', 'root @swc/core');
    test(macro, 'tsconfig-swc-wasm.json', 'root @swc/wasm');
    test(macro, 'tsconfig-swc.json', 'root @swc/core');

    test(macro, 'node_modules/shared-config/tsconfig-custom-compiler.json', 'shared-config custom compiler');
    test(macro, 'node_modules/shared-config/tsconfig-custom-transpiler.json', 'shared-config custom transpiler');
    test(macro, 'node_modules/shared-config/tsconfig-swc-custom-backend.json', 'shared-config custom swc backend');
    test(macro, 'node_modules/shared-config/tsconfig-swc-core.json', 'shared-config @swc/core');
    test(macro, 'node_modules/shared-config/tsconfig-swc-wasm.json', 'shared-config @swc/wasm');
    test(macro, 'node_modules/shared-config/tsconfig-swc.json', 'shared-config @swc/core');

    test.suite('"extends"', (test) => {
      test(macro, 'tsconfig-extend-custom-compiler.json', 'shared-config custom compiler');
      test(macro, 'tsconfig-extend-custom-transpiler.json', 'shared-config custom transpiler');
      test(macro, 'tsconfig-extend-swc-custom-backend.json', 'shared-config custom swc backend');
      test(macro, 'tsconfig-extend-swc-core.json', 'shared-config @swc/core');
      test(macro, 'tsconfig-extend-swc-wasm.json', 'shared-config @swc/wasm');
      test(macro, 'tsconfig-extend-swc.json', 'shared-config @swc/core');
    });
  }
);
