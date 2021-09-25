import { once } from 'lodash';
import type * as tsNodeTypes from '../index';
import {
  installTsNode,
  PROJECT,
  testsDirRequire,
  TEST_DIR,
} from './before-all';
import { test } from './testlib';
import { expect } from 'chai';
import { join } from 'path';
import proxyquire = require('proxyquire');
import type * as Module from 'module';

const SOURCE_MAP_REGEXP = /\/\/# sourceMappingURL=data:application\/json;charset=utf\-8;base64,[\w\+]+=*$/;

// Set after ts-node is installed locally
let { register }: typeof tsNodeTypes = {} as any;
test.beforeAll(async () => {
  await installTsNode();
  ({ register } = testsDirRequire('ts-node'));
});

test.suite('register', (_test) => {
  const test = _test.context(
    once(async () => {
      return {
        registered: register({
          project: PROJECT,
          compilerOptions: {
            jsx: 'preserve',
          },
        }),
        moduleTestPath: require.resolve('../../tests/module'),
      };
    })
  );
  test.beforeEach(async ({ context: { registered } }) => {
    // Re-enable project for every test.
    registered.enabled(true);
  });
  test.runSerially();

  test('should be able to require typescript', ({
    context: { moduleTestPath },
  }) => {
    const m = require(moduleTestPath);

    expect(m.example('foo')).to.equal('FOO');
  });

  test('should support dynamically disabling', ({
    context: { registered, moduleTestPath },
  }) => {
    delete require.cache[moduleTestPath];

    expect(registered.enabled(false)).to.equal(false);
    expect(() => require(moduleTestPath)).to.throw(/Unexpected token/);

    delete require.cache[moduleTestPath];

    expect(registered.enabled()).to.equal(false);
    expect(() => require(moduleTestPath)).to.throw(/Unexpected token/);

    delete require.cache[moduleTestPath];

    expect(registered.enabled(true)).to.equal(true);
    expect(() => require(moduleTestPath)).to.not.throw();

    delete require.cache[moduleTestPath];

    expect(registered.enabled()).to.equal(true);
    expect(() => require(moduleTestPath)).to.not.throw();
  });

  test('should support compiler scopes', ({
    context: { registered, moduleTestPath },
  }) => {
    const calls: string[] = [];

    registered.enabled(false);

    const compilers = [
      register({
        projectSearchDir: join(TEST_DIR, 'scope/a'),
        scopeDir: join(TEST_DIR, 'scope/a'),
        scope: true,
      }),
      register({
        projectSearchDir: join(TEST_DIR, 'scope/a'),
        scopeDir: join(TEST_DIR, 'scope/b'),
        scope: true,
      }),
    ];

    compilers.forEach((c) => {
      const old = c.compile;
      c.compile = (code, fileName, lineOffset) => {
        calls.push(fileName);

        return old(code, fileName, lineOffset);
      };
    });

    try {
      expect(require('../../tests/scope/a').ext).to.equal('.ts');
      expect(require('../../tests/scope/b').ext).to.equal('.ts');
    } finally {
      compilers.forEach((c) => c.enabled(false));
    }

    expect(calls).to.deep.equal([
      join(TEST_DIR, 'scope/a/index.ts'),
      join(TEST_DIR, 'scope/b/index.ts'),
    ]);

    delete require.cache[moduleTestPath];

    expect(() => require(moduleTestPath)).to.throw();
  });

  test('should compile through js and ts', () => {
    const m = require('../../tests/complex');

    expect(m.example()).to.equal('example');
  });

  test('should work with proxyquire', () => {
    const m = proxyquire('../../tests/complex', {
      './example': 'hello',
    });

    expect(m.example()).to.equal('hello');
  });

  test('should work with `require.cache`', () => {
    const { example1, example2 } = require('../../tests/require-cache');

    expect(example1).to.not.equal(example2);
  });

  test('should use source maps', async () => {
    try {
      require('../../tests/throw error');
    } catch (error: any) {
      expect(error.stack).to.contain(
        [
          'Error: this is a demo',
          `    at Foo.bar (${join(TEST_DIR, './throw error.ts')}:100:17)`,
        ].join('\n')
      );
    }
  });

  test.suite('JSX preserve', (test) => {
    let old: (m: Module, filename: string) => any;
    let compiled: string;

    test.runSerially();
    test.beforeAll(async () => {
      old = require.extensions['.tsx']!;
      require.extensions['.tsx'] = (m: any, fileName) => {
        const _compile = m._compile;

        m._compile = function (code: string, fileName: string) {
          compiled = code;
          return _compile.call(this, code, fileName);
        };

        return old(m, fileName);
      };
    });

    test('should use source maps', async (t) => {
      t.teardown(() => {
        require.extensions['.tsx'] = old;
      });
      try {
        require('../../tests/with-jsx.tsx');
      } catch (error: any) {
        expect(error.stack).to.contain('SyntaxError: Unexpected token');
      }

      expect(compiled).to.match(SOURCE_MAP_REGEXP);
    });
  });
});
