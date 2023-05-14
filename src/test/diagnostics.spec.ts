import type { TSError } from '..';
import { ctxTsNode, ts } from './helpers';
import { context, expect } from './testlib';
import * as semver from 'semver';
import { once } from 'lodash';
const test = context(ctxTsNode);

test.suite('TSError diagnostics', ({ context }) => {
  const test = context(async (t) => {
    // Locking to es2020, because:
    // 1) es2022 -- default in @tsconfig/bases for node18 -- changes this diagnostic
    //   to be a composite "No overload matches this call."
    // 2) TS 4.2 doesn't support es2021 or higher
    const service = t.context.tsNodeUnderTest.create({
      compilerOptions: { target: 'es5', lib: ['es2020'] },
      skipProject: true,
    });
    try {
      service.compile('new Error(123)', 'test.ts');
    } catch (err) {
      return { err: err as TSError };
    }
    return { err: undefined };
  });

  const diagnosticCode = 2345;
  const diagnosticMessage = /Argument of type '.*?' is not assignable to parameter of type 'string( \| undefined)?'./;
  const diagnosticErrorMessage =
    /TS2345: Argument of type '.*?' is not assignable to parameter of type 'string( \| undefined)?'./;

  test('should throw errors', (t) => {
    const { err } = t.context;
    expect(err).toBeDefined();
    expect(err!).toMatchObject({
      message: expect.stringMatching(diagnosticErrorMessage),
      diagnosticText: expect.stringMatching(diagnosticErrorMessage),
      diagnosticCodes: [diagnosticCode],
      diagnostics: [
        {
          code: diagnosticCode,
          start: 10,
          length: 3,
          messageText: expect.stringMatching(diagnosticMessage),
        },
      ],
    });
  });
});
