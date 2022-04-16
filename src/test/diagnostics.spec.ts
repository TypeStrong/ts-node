import type { TSError } from '..';
import { contextTsNodeUnderTest, ts } from './helpers';
import { context, expect } from './testlib';
import * as semver from 'semver';
import { assert } from 'console';
const test = context(contextTsNodeUnderTest);

test.suite('TSError diagnostics', ({ context }) => {
  const test = context(async (t) => {
    return {
      service: t.context.tsNodeUnderTest.create({
        compilerOptions: { target: 'es5' },
        skipProject: true,
      }),
    };
  }).context(async (t) => {
    try {
      t.context.service.compile('new Error(123)', 'test.ts');
    } catch (err) {
      return { threw: true, err };
    }
    return { threw: false, err: undefined };
  });

  // TS 2.7 does not have the union type for some reason.
  const diagnosticMessageRegexp = new RegExp(
    "TS2345: Argument of type '123' " +
      "is not assignable to parameter of type 'string'\\."
  );

  test('should throw errors', ({ context: { threw, err } }) => {
    expect(threw).toBe(true);
    expect((err as Error).message).toMatch(diagnosticMessageRegexp);
  });

  test('should throw errors with diagnostic text', ({ context: { err } }) => {
    expect((err as TSError).diagnosticText).toMatch(diagnosticMessageRegexp);
  });

  test('should throw errors with diagnostic codes', ({ context: { err } }) => {
    expect((err as TSError).diagnosticCodes).toEqual([2345]);
  });

  test('should throw errors with complete diagnostic information', ({
    context: { err },
  }) => {
    const diagnostics = (err as TSError).diagnostics;

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      code: 2345,
      start: 10,
      length: 3,
      messageText:
        "Argument of type '123' " +
        "is not assignable to parameter of type 'string | undefined'.",
    });
  });
});
