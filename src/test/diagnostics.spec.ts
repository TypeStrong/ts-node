import type { TSError } from '..';
import { ctxTsNode, ts } from './helpers';
import { context, expect } from './testlib';
import * as semver from 'semver';
import { once } from 'lodash';
const test = context(ctxTsNode);

test.suite('TSError diagnostics', ({ context }) => {
  const test = context(
    once(async (t) => {
      const service = t.context.tsNodeUnderTest.create({
        compilerOptions: { target: 'es5' },
        skipProject: true,
      });
      try {
        service.compile('new Error(123)', 'test.ts');
      } catch (err) {
        return { service, err };
      }
      return { service, err: undefined };
    })
  );

  const diagnosticCode = 2345;
  const diagnosticMessage = semver.satisfies(ts.version, '2.7')
    ? "Argument of type '123' " +
      "is not assignable to parameter of type 'string | undefined'."
    : "Argument of type 'number' " +
      "is not assignable to parameter of type 'string'.";
  const diagnosticErrorMessage = `TS${diagnosticCode}: ${diagnosticMessage}`;

  const cwdBefore = process.cwd();
  test('should throw errors', ({ log, context: { err, service } }) => {
    log({
      version: ts.version,
      serviceVersion: service.ts.version,
      cwdBefore,
      cwd: process.cwd(),
      configFilePath: service.configFilePath,
      config: service.config.options,
    });
    expect(err).toBeDefined();
    expect((err as Error).message).toMatch(diagnosticErrorMessage);
  });

  test('should throw errors with diagnostic text', ({ context: { err } }) => {
    expect((err as TSError).diagnosticText).toMatch(diagnosticErrorMessage);
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
      messageText: expect.stringMatching(diagnosticMessage),
    });
  });
});
