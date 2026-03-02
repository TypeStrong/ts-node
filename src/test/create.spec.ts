import { ctxTsNode } from './helpers';
import { context, expect } from './testlib';

const test = context(ctxTsNode);

test.suite('create', ({ contextEach }) => {
  const test = contextEach(async (t) => {
    return {
      service: t.context.tsNodeUnderTest.create({
        compilerOptions: { target: 'es5' },
        skipProject: true,
      }),
    };
  });

  test('should create generic compiler instances', (t) => {
    const output = t.context.service.compile('const x = 10', 'test.ts');
    expect(output).toMatch('var x = 10;');
  });

  test.suite('should get type information', (test) => {
    test('given position of identifier', (t) => {
      expect(t.context.service.getTypeInfo('/**jsdoc here*/const x = 10', 'test.ts', 21)).toEqual({
        comment: 'jsdoc here',
        name: 'const x: 10',
      });
    });
    test('given position that does not point to an identifier', (t) => {
      expect(t.context.service.getTypeInfo('/**jsdoc here*/const x = 10', 'test.ts', 0)).toEqual({
        comment: '',
        name: '',
      });
    });
  });
});
