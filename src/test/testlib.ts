/*
 * Extensions to ava, for declaring and running test cases and suites
 * Utilities specific to testing ts-node, for example handling streams and exec-ing processes,
 * should go in a separate module.
 */

import avaTest, {
  ExecutionContext,
  Implementation,
  OneOrMoreMacros,
} from 'ava';
import * as assert from 'assert';
import throat from 'throat';
import * as expect from 'expect';

export { ExecutionContext, expect };

// HACK ensure ts-node-specific bootstrapping is executed
import './helpers';

// NOTE: this limits concurrency within a single process, but AVA launches
// each .spec file in its own process, so actual concurrency is higher.
const concurrencyLimiter = throat(16);

function errorPostprocessor<T extends Function>(fn: T): T {
  return async function (this: any) {
    try {
      return await fn.call(this, arguments);
    } catch (error: any) {
      delete error?.matcherResult;
      // delete error?.matcherResult?.message;
      if (error?.message) error.message = `\n${error.message}\n`;
      throw error;
    }
  } as any;
}

function once<T extends Function>(func: T): T {
  let run = false;
  let ret: any = undefined;
  return function (...args: any[]) {
    if (run) return ret;
    run = true;
    ret = func(...args);
    return ret;
  } as any as T;
}

export const test = createTestInterface({
  beforeEachFunctions: [],
  mustDoSerial: false,
  automaticallyDoSerial: false,
  automaticallySkip: false,
  // The little right chevron used by ava
  separator: ' \u203a ',
  titlePrefix: undefined,
});
// In case someone wants to `const test = _test.context()`
export { test as _test };
// Or import `context`
export const context = test.context;

export interface TestInterface<
  Context
> /*extends Omit<AvaTestInterface<Context>, 'before' | 'beforeEach' | 'after' | 'afterEach' | 'failing' | 'serial'>*/ {
  //#region copy-pasted from ava's .d.ts
  /** Declare a concurrent test. */
  (title: string, implementation: Implementation<Context>): void;
  /** Declare a concurrent test that uses one or more macros. Additional arguments are passed to the macro. */
  <T extends any[]>(
    title: string,
    macros: OneOrMoreMacros<T, Context>,
    ...rest: T
  ): void;
  /** Declare a concurrent test that uses one or more macros. The macro is responsible for generating a unique test title. */
  <T extends any[]>(macros: OneOrMoreMacros<T, Context>, ...rest: T): void;
  //#endregion

  serial(title: string, implementation: Implementation<Context>): void;
  /** Declare a concurrent test that uses one or more macros. Additional arguments are passed to the macro. */
  serial<T extends any[]>(
    title: string,
    macros: OneOrMoreMacros<T, Context>,
    ...rest: T
  ): void;
  /** Declare a concurrent test that uses one or more macros. The macro is responsible for generating a unique test title. */
  serial<T extends any[]>(
    macros: OneOrMoreMacros<T, Context>,
    ...rest: T
  ): void;

  macro<Args extends any[]>(
    cb: (
      ...args: Args
    ) =>
      | [
          (title: string | undefined) => string | undefined,
          (t: ExecutionContext<Context>) => Promise<void>
        ]
      | ((t: ExecutionContext<Context>) => Promise<void>)
  ): (
    test: ExecutionContext<Context>,
    ...args: Args
  ) => Promise<void> & {
    title(givenTitle: string | undefined, ...args: Args): string;
  };

  beforeAll(cb: (t: ExecutionContext<Context>) => Promise<void>): void;
  beforeEach(cb: (t: ExecutionContext<Context>) => Promise<void>): void;
  context<T extends object | void>(
    cb: (t: ExecutionContext<Context>) => Promise<T>
  ): TestInterface<Context & T>;
  suite(title: string, cb: (test: TestInterface<Context>) => void): void;

  runSerially(): void;

  /** Skip tests unless this condition is met */
  skipUnless(conditional: boolean): void;
  /** If conditional is true, run tests, otherwise skip them */
  runIf(conditional: boolean): void;
  /** If conditional is false, skip tests */
  skipIf(conditional: boolean): void;

  // TODO add teardownEach
}
function createTestInterface<Context>(opts: {
  titlePrefix: string | undefined;
  separator: string | undefined;
  mustDoSerial: boolean;
  automaticallyDoSerial: boolean;
  automaticallySkip: boolean;
  beforeEachFunctions: Function[];
}): TestInterface<Context> {
  const { titlePrefix, separator = ' > ' } = opts;
  const beforeEachFunctions = [...(opts.beforeEachFunctions ?? [])];
  let { mustDoSerial, automaticallyDoSerial, automaticallySkip } = opts;
  let hookDeclared = false;
  let suiteOrTestDeclared = false;
  function computeTitle(title: string | undefined) {
    assert(title);
    // return `${ titlePrefix }${ separator }${ title }`;
    if (titlePrefix != null && title != null) {
      return `${titlePrefix}${separator}${title}`;
    }
    if (titlePrefix == null && title != null) {
      return title;
    }
  }
  function parseArgs(args: any[]) {
    const title =
      typeof args[0] === 'string' ? (args.shift() as string) : undefined;
    const macros =
      typeof args[0] === 'function'
        ? [args.shift() as Function]
        : Array.isArray(args[0])
        ? (args.shift() as Function[])
        : [];
    return { title, macros, args };
  }
  function assertOrderingForDeclaringTest() {
    suiteOrTestDeclared = true;
  }
  function assertOrderingForDeclaringHook() {
    if (suiteOrTestDeclared) {
      throw new Error(
        'Hooks must be declared before declaring sub-suites or tests'
      );
    }
    hookDeclared = true;
  }
  function assertOrderingForDeclaringSkipUnless() {
    if (suiteOrTestDeclared) {
      throw new Error(
        'skipUnless or runIf must be declared before declaring sub-suites or tests'
      );
    }
  }
  /**
   * @param avaDeclareFunction either test or test.serial
   */
  function declareTest(
    title: string | undefined,
    macros: Function[],
    avaDeclareFunction: Function & { skip: Function },
    args: any[]
  ) {
    const wrappedMacros = macros.map((macro) => {
      return async function (t: ExecutionContext<Context>, ...args: any[]) {
        return concurrencyLimiter(
          errorPostprocessor(async () => {
            let i = 0;
            for (const func of beforeEachFunctions) {
              await func(t);
              i++;
            }
            return macro(t, ...args);
          })
        );
      };
    });
    const computedTitle = computeTitle(title);
    (automaticallySkip ? avaDeclareFunction.skip : avaDeclareFunction)(
      computedTitle,
      wrappedMacros,
      ...args
    );
  }
  function test(...inputArgs: any[]) {
    assertOrderingForDeclaringTest();
    // TODO is this safe to disable?
    // X parallel tests will each invoke the beforeAll hook, but once()ification means each invocation will return the same promise, and tests cannot
    // start till it finishes.
    // HOWEVER if it returns a single shared state, can tests concurrently use this shared state?
    // if(!automaticallyDoSerial && mustDoSerial) throw new Error('Cannot declare non-serial tests because you have declared a beforeAll() hook for this test suite.');
    const { args, macros, title } = parseArgs(inputArgs);
    return declareTest(
      title,
      macros,
      automaticallyDoSerial ? avaTest.serial : avaTest,
      args
    );
  }
  test.serial = function (...inputArgs: any[]) {
    assertOrderingForDeclaringTest();
    const { args, macros, title } = parseArgs(inputArgs);
    return declareTest(title, macros, avaTest.serial, args);
  };
  test.beforeEach = function (
    cb: (test: ExecutionContext<Context>) => Promise<void>
  ) {
    assertOrderingForDeclaringHook();
    beforeEachFunctions.push(cb);
  };
  test.context = function (
    cb: (test: ExecutionContext<Context>) => Promise<any>
  ) {
    assertOrderingForDeclaringHook();
    beforeEachFunctions.push(async (t: ExecutionContext<Context>) => {
      const addedContextFields = await cb(t);
      Object.assign(t.context, addedContextFields);
    });
    return test;
  };
  test.beforeAll = function (
    cb: (test: ExecutionContext<Context>) => Promise<void>
  ) {
    assertOrderingForDeclaringHook();
    mustDoSerial = true;
    beforeEachFunctions.push(once(cb));
  };
  test.macro = function <Args extends any[]>(
    cb: (
      ...args: Args
    ) =>
      | [
          (title: string | undefined) => string,
          (t: ExecutionContext<Context>) => Promise<void>
        ]
      | ((t: ExecutionContext<Context>) => Promise<void>)
  ) {
    function macro(testInterface: ExecutionContext<Context>, ...args: Args) {
      const ret = cb(...args);
      const macroFunction = Array.isArray(ret) ? ret[1] : ret;
      return macroFunction(testInterface);
    }
    macro.title = function (givenTitle: string | undefined, ...args: Args) {
      const ret = cb(...args);
      return Array.isArray(ret) ? ret[0](givenTitle) : givenTitle;
    };
    return macro;
  };
  test.suite = function (
    title: string,
    cb: (test: TestInterface<Context>) => void
  ) {
    suiteOrTestDeclared = true;
    const newApi = createTestInterface<Context>({
      mustDoSerial,
      automaticallyDoSerial,
      automaticallySkip,
      separator,
      titlePrefix: computeTitle(title),
      beforeEachFunctions,
    });
    cb(newApi);
  };
  test.runSerially = function () {
    automaticallyDoSerial = true;
  };
  test.skipUnless = test.runIf = function (runIfTrue: boolean) {
    assertOrderingForDeclaringSkipUnless();
    automaticallySkip = automaticallySkip || !runIfTrue;
  };
  test.skipIf = function (skipIfTrue: boolean) {
    test.runIf(!skipIfTrue);
  };
  return test as any;
}
