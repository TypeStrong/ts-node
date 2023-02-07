/*
 * Extensions to ava, for declaring and running test cases and suites
 * Utilities specific to testing ts-node, for example handling streams and exec-ing processes,
 * should go in a separate module.
 */

import avaTest, {
  ExecutionContext,
  Implementation,
  ImplementationFn,
  Macro,
  MacroDeclarationOptions,
  MacroFn,
  TestFn,
} from 'ava';
import * as assert from 'assert';
import throat from 'throat';
import * as expect from 'expect';

export { ExecutionContext, expect };

// HACK ensure ts-node-specific bootstrapping is executed
import './helpers';

// NOTE: this limits concurrency within a single process, but AVA launches
// each .spec file in its own process, so actual concurrency is higher.
const concurrencyLimiter = throat(4);

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
// In case someone wants to `const test = context()`
export const context = test.context;

export type SimpleTitleFn = (providedTitle: string | undefined) => string;
export type SimpleImplementationFn<Context = unknown> = (
  t: ExecutionContext<Context>
) => PromiseLike<void>;
export type SimpleContextFn<Context, T> = (
  t: ExecutionContext<Context>
) => Promise<T>;

export interface TestInterface<
  Context
> /*extends Omit<AvaTestInterface<Context>, 'before' | 'beforeEach' | 'after' | 'afterEach' | 'failing' | 'serial'>*/ {
  //#region copy-pasted from ava's .d.ts
  /** Declare a concurrent test. */
  (title: string, implementation: Implementation<unknown[], Context>): void;
  /** Declare a concurrent test that uses one or more macros. Additional arguments are passed to the macro. */
  <T extends any[]>(
    title: string,
    implementation: Implementation<T, Context>,
    ...rest: T
  ): void;
  /** Declare a concurrent test that uses one or more macros. The macro is responsible for generating a unique test title. */
  <T extends any[]>(macro: Implementation<T, Context>, ...rest: T): void;
  //#endregion

  serial(
    title: string,
    implementation: Implementation<unknown[], Context>
  ): void;
  /** Declare a concurrent test that uses one or more macros. Additional arguments are passed to the macro. */
  serial<T extends any[]>(
    title: string,
    implementation: Implementation<T, Context>,
    ...rest: T
  ): void;
  /** Declare a concurrent test that uses one or more macros. The macro is responsible for generating a unique test title. */
  serial<T extends any[]>(
    implementation: Implementation<T, Context>,
    ...rest: T
  ): void;
  skip(title: string, implementation: Implementation<unknown[], Context>): void;
  /** Declare a concurrent test that uses one or more macros. Additional arguments are passed to the macro. */
  skip<T extends any[]>(
    title: string,
    implementation: Implementation<T, Context>,
    ...rest: T
  ): void;
  /** Declare a concurrent test that uses one or more macros. The macro is responsible for generating a unique test title. */
  skip<T extends any[]>(
    implementation: Implementation<T, Context>,
    ...rest: T
  ): void;

  macro<Args extends any[], Ctx = Context>(
    cb: (
      ...args: Args
    ) =>
      | [SimpleTitleFn | string, SimpleImplementationFn<Ctx>]
      | SimpleImplementationFn<Ctx>
  ): Macro<Args, Ctx>;

  avaMacro: MacroFn<Context>;

  beforeAll(cb: SimpleImplementationFn<Context>): void;
  beforeEach(cb: SimpleImplementationFn<Context>): void;
  context<T extends object | void>(
    cb: SimpleContextFn<Context, T>
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
  function computeTitle<Args extends any[]>(
    title: string | undefined,
    impl?: Implementation<Args, any>,
    ...args: Args
  ) {
    if (isMacroWithTitle(impl)) {
      title = impl.title!(title, ...args);
    }
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
    const impl = args.shift() as Implementation<any[], Context>;
    return { title, impl, args };
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
    impl: Implementation<any[], Context>,
    avaDeclareFunction: Function & { skip: Function },
    args: any[],
    skip = false
  ) {
    const wrapped = async function (
      t: ExecutionContext<Context>,
      ...args: any[]
    ) {
      return concurrencyLimiter(
        errorPostprocessor(async () => {
          let i = 0;
          for (const func of beforeEachFunctions) {
            await func(t);
            i++;
          }
          return isMacro(impl)
            ? impl.exec(t, ...args)
            : (impl as ImplementationFn<any[], Context>)(t, ...args);
        })
      );
    };
    const computedTitle = computeTitle(title, impl, ...args);
    (automaticallySkip || skip ? avaDeclareFunction.skip : avaDeclareFunction)(
      computedTitle,
      wrapped,
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
    const { args, impl, title } = parseArgs(inputArgs);
    return declareTest(
      title,
      impl,
      automaticallyDoSerial ? avaTest.serial : avaTest,
      args
    );
  }
  test.serial = function (...inputArgs: any[]) {
    assertOrderingForDeclaringTest();
    const { args, impl, title } = parseArgs(inputArgs);
    return declareTest(title, impl, avaTest.serial, args);
  };
  test.skip = function (...inputArgs: any[]) {
    assertOrderingForDeclaringTest();
    const { args, impl, title } = parseArgs(inputArgs);
    return declareTest(title, impl, avaTest, args, true);
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
      | [SimpleTitleFn | string, SimpleImplementationFn<Context>]
      | SimpleImplementationFn<Context>
  ) {
    function title(givenTitle: string | undefined, ...args: Args) {
      const ret = cb(...args);
      return Array.isArray(ret)
        ? typeof ret[0] === 'string'
          ? ret[0]
          : ret[0](givenTitle)
        : givenTitle ?? 'UNKNOWN';
    }
    function exec(testInterface: ExecutionContext<Context>, ...args: Args) {
      const ret = cb(...args);
      const impl = Array.isArray(ret) ? ret[1] : ret;
      return impl(testInterface);
    }
    const declaration: MacroDeclarationOptions<Args, Context> = {
      title,
      exec,
    };
    return (avaTest as TestFn<Context>).macro<Args>(declaration);
  };
  test.avaMacro = (avaTest as TestFn<Context>).macro;
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

function isMacro(
  implementation?: Implementation<any, any>
): implementation is Macro<any> {
  return implementation != null && typeof implementation !== 'function';
}
function isMacroWithTitle(
  implementation?: Implementation<any, any>
): implementation is Macro<any> {
  return !!(implementation && (implementation as Macro<[]>)?.title);
}
