// third-party transpiler and swc transpiler tests
// TODO: at the time of writing, other transpiler tests have not been moved into this file.
// Should consolidate them here.

import { context } from './testlib';
import {
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  createExec,
  ctxTsNode,
  testsDirRequire,
  TEST_DIR,
  tsSupportsImportAssertions,
  tsSupportsReact17JsxFactories,
  tsSupportsEs2022,
} from './helpers';
import { createSwcOptions } from '../transpilers/swc';
import * as expect from 'expect';
import { outdent } from 'outdent';
import { join } from 'path';

const test = context(ctxTsNode);

test.suite('swc', (test) => {
  test('verify that TS->SWC target mappings suppport all possible values from both TS and SWC', async (t) => {
    const swcTranspiler = testsDirRequire(
      'ts-node/transpilers/swc-experimental'
    ) as typeof import('../transpilers/swc');

    // Detect when mapping is missing any ts.ScriptTargets
    const ts = testsDirRequire('typescript') as typeof import('typescript');
    for (const key of Object.keys(ts.ScriptTarget)) {
      if (/^\d+$/.test(key)) continue;
      if (key === 'JSON') continue;
      expect(swcTranspiler.targetMapping.has(ts.ScriptTarget[key as any] as any)).toBe(true);
    }

    // Detect when mapping is missing any swc targets
    // Assuming that tests/package.json declares @swc/core: latest
    const swc = testsDirRequire('@swc/core');
    let msg: string | undefined = undefined;
    try {
      swc.transformSync('', { jsc: { target: 'invalid' } });
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toBeDefined();
    // Error looks like:
    // unknown variant `invalid`, expected one of `es3`, `es5`, `es2015`, `es2016`, `es2017`, `es2018`, `es2019`, `es2020`, `es2021` at line 1 column 28
    const match = msg!.match(/unknown variant.*, expected one of (.*) at line/);
    expect(match).toBeDefined();
    const targets = match![1].split(', ').map((v: string) => v.slice(1, -1));

    for (const target of targets) {
      expect([...swcTranspiler.targetMapping.values()]).toContain(target);
    }
  });

  test.suite('converts TS config to swc config', (test) => {
    test.suite('jsx', (test) => {
      const macro = test.macro((jsx: string, runtime?: string, development?: boolean) => [
        () => `jsx=${jsx}`,
        async (t) => {
          const tsNode = t.context.tsNodeUnderTest.create({
            compilerOptions: {
              jsx,
            },
          });
          const swcOptions = createSwcOptions(tsNode.config.options, undefined, require('@swc/core'), '@swc/core');
          expect(swcOptions.tsxOptions.jsc?.transform?.react).toBeDefined();
          expect(swcOptions.tsxOptions.jsc?.transform?.react?.development).toBe(development);
          expect(swcOptions.tsxOptions.jsc?.transform?.react?.runtime).toBe(runtime);
        },
      ]);

      test(macro, 'react', undefined, undefined);
      test.suite('react 17 jsx factories', (test) => {
        test.if(tsSupportsReact17JsxFactories);
        test(macro, 'react-jsx', 'automatic', undefined);
        test(macro, 'react-jsxdev', 'automatic', true);
      });
    });
  });

  const compileMacro = test.macro((compilerOptions: object, input: string, expectedOutput: string) => [
    (title?: string) => title ?? `${JSON.stringify(compilerOptions)}`,
    async (t) => {
      const code = t.context.tsNodeUnderTest
        .create({
          swc: true,
          skipProject: true,
          compilerOptions,
        })
        .compile(input, 'input.tsx');
      expect(code.replace(/\/\/# sourceMappingURL.*/, '').trim()).toBe(expectedOutput);
    },
  ]);

  test.suite('transforms various forms of jsx', (test) => {
    const input = outdent`
      const div = <div></div>;
    `;

    test(
      compileMacro,
      { module: 'esnext', target: 'es2020', jsx: 'react' },
      input,
      `const div = /*#__PURE__*/ React.createElement("div", null);`
    );
    test.suite('react 17 jsx factories', (test) => {
      test.if(tsSupportsReact17JsxFactories);
      test(
        compileMacro,
        { module: 'esnext', target: 'es2020', jsx: 'react-jsx' },
        input,
        outdent`
          import { jsx as _jsx } from "react/jsx-runtime";
          const div = /*#__PURE__*/ _jsx("div", {});
        `
      );
      test(
        compileMacro,
        { module: 'esnext', target: 'es2020', jsx: 'react-jsxdev' },
        input,
        outdent`
          import { jsxDEV as _jsxDEV } from "react/jsx-dev-runtime";
          const div = /*#__PURE__*/ _jsxDEV("div", {}, void 0, false, {
              fileName: "input.tsx",
              lineNumber: 1,
              columnNumber: 13
          }, this);
        `
      );
    });
  });

  test.suite('preserves import assertions for json imports', (test) => {
    test.if(tsSupportsImportAssertions);
    test(
      'basic json import',
      compileMacro,
      { module: 'esnext' },
      outdent`
        import document from './document.json' assert {type: 'json'};
        document;
      `,
      outdent`
        import document from './document.json' assert {
            type: 'json'
        };
        document;
      `
    );
  });

  test.suite('useDefineForClassFields', (test) => {
    const input = outdent`
      class Foo {
        bar = 1;
      }
    `;
    const outputNative = outdent`
      let Foo = class Foo {
          bar = 1;
      };
    `;
    const outputCtorAssignment = outdent`
      let Foo = class Foo {
          constructor(){
              this.bar = 1;
          }
      };
    `;
    const outputCtorAssignmentInEs5Class = outdent`
      function _class_call_check(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
              throw new TypeError("Cannot call a class as a function");
          }
      }
      var Foo = function Foo() {
          "use strict";
          _class_call_check(this, Foo);
          this.bar = 1;
      };
    `;
    const outputDefine = outdent`
      function _define_property(obj, key, value) {
          if (key in obj) {
              Object.defineProperty(obj, key, {
                  value: value,
                  enumerable: true,
                  configurable: true,
                  writable: true
              });
          } else {
              obj[key] = value;
          }
          return obj;
      }
      let Foo = class Foo {
          constructor(){
              _define_property(this, "bar", 1);
          }
      };
    `;
    const outputDefineInEs5Class = outdent`
      function _class_call_check(instance, Constructor) {
          if (!(instance instanceof Constructor)) {
              throw new TypeError("Cannot call a class as a function");
          }
      }
      function _define_property(obj, key, value) {
          if (key in obj) {
              Object.defineProperty(obj, key, {
                  value: value,
                  enumerable: true,
                  configurable: true,
                  writable: true
              });
          } else {
              obj[key] = value;
          }
          return obj;
      }
      var Foo = function Foo() {
          "use strict";
          _class_call_check(this, Foo);
          _define_property(this, "bar", 1);
      };
    `;
    test(
      'useDefineForClassFields unset, `next` target, should default to true and emit native property assignment',
      compileMacro,
      { module: 'esnext', target: 'ESNext' },
      input,
      outputNative
    );
    test.suite(
      'useDefineForClassFields unset, new target, should default to true and emit native property assignment',
      (test) => {
        test.if(tsSupportsEs2022);
        test(compileMacro, { module: 'esnext', target: 'ES2022' }, input, outputNative);
      }
    );
    test(
      'useDefineForClassFields unset, should default to false b/c old target',
      compileMacro,
      { module: 'esnext', target: 'ES2021' },
      input,
      outputCtorAssignment
    );
    test.suite('useDefineForClassFields=true, new target, should emit native property assignment', (test) => {
      test.if(tsSupportsEs2022);
      test(
        compileMacro,
        {
          module: 'esnext',
          target: 'ES2022',
          useDefineForClassFields: true,
        },
        input,
        outputNative
      );
    });
    test(
      'useDefineForClassFields=true, old target, should emit define',
      compileMacro,
      {
        module: 'esnext',
        target: 'ES2021',
        useDefineForClassFields: true,
      },
      input,
      outputDefine
    );
    test.suite(
      'useDefineForClassFields=false, new target, should still emit legacy property assignment in ctor',
      (test) => {
        test.if(tsSupportsEs2022);
        test(
          compileMacro,
          {
            module: 'esnext',
            target: 'ES2022',
            useDefineForClassFields: false,
          },
          input,
          outputCtorAssignment
        );
      }
    );
    test(
      'useDefineForClassFields=false, old target, should emit legacy property assignment in ctor',
      compileMacro,
      {
        module: 'esnext',
        target: 'ES2021',
        useDefineForClassFields: false,
      },
      input,
      outputCtorAssignment
    );
    test(
      'useDefineForClassFields=false, ancient target, should emit legacy property assignment in legacy function-based class',
      compileMacro,
      {
        module: 'esnext',
        target: 'es5',
        useDefineForClassFields: false,
      },
      input,
      outputCtorAssignmentInEs5Class
    );
    test(
      'useDefineForClassFields=true, ancient target, should emit define in legacy function-based class',
      compileMacro,
      {
        module: 'esnext',
        target: 'es5',
        useDefineForClassFields: true,
      },
      input,
      outputDefineInEs5Class
    );
  });

  test.suite('jsx and jsxImportSource', (test) => {
    test(
      'jsx=react-jsx',
      compileMacro,
      {
        module: 'esnext',
        jsx: 'react-jsx',
      },
      outdent`
      <div></div>
    `,
      outdent`
      /*#__PURE__*/ import { jsx as _jsx } from "react/jsx-runtime";
      _jsx("div", {});
    `
    );
    test(
      'jsx=react-jsx w/custom jsxImportSource',
      compileMacro,
      {
        module: 'esnext',
        jsx: 'react-jsx',
        jsxImportSource: 'foo',
      },
      outdent`
      <div></div>
    `,
      outdent`
      /*#__PURE__*/ import { jsx as _jsx } from "foo/jsx-runtime";
      _jsx("div", {});
    `
    );
  });

  test.suite(
    '#1996 regression: ts-node gracefully allows swc to not return a sourcemap for type-only files',
    (test) => {
      // https://github.com/TypeStrong/ts-node/issues/1996
      // @swc/core 1.3.51 returned `undefined` instead of sourcemap if the file was empty or only exported types.
      // Newer swc versions do not do this. But our typedefs technically allow it.
      const exec = createExec({
        cwd: join(TEST_DIR, '1996'),
      });
      test('import empty file w/swc', async (t) => {
        const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} ./index.ts`);
        expect(r.err).toBe(null);
        expect(r.stdout).toMatch(/#1996 regression test./);
      });
      test('use custom transpiler which never returns a sourcemap', async (t) => {
        const r = await exec(
          `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} --project tsconfig.custom-transpiler.json ./empty.ts`
        );
        expect(r.err).toBe(null);
        expect(r.stdout).toMatch(/#1996 regression test with custom transpiler./);
      });
    }
  );
});
