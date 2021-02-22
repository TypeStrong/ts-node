import avaTest, { ExecutionContext, Implementation, OneOrMoreMacros } from 'ava'
import * as assert from 'assert'
import throat from 'throat'

const concurrencyLimiter = throat(8)

function once<T extends Function> (func: T): T {
  let run = false
  let ret: any = undefined
  return function (...args: any[]) {
    if (run) return ret
    run = true
    ret = func(...args)
    return ret
  } as any as T
}

export const test = createTestInterface({
  beforeEachFunctions: [],
  mustDoSerial: false,
  automaticallyDoSerial: false,
  separator: ' > ',
  titlePrefix: undefined
})
export interface TestInterface<Context> /*extends Omit<AvaTestInterface<Context>, 'before' | 'beforeEach' | 'after' | 'afterEach' | 'failing' | 'serial'>*/ {

  //#region copy-pasted from ava's .d.ts
	/** Declare a concurrent test. */
  (title: string, implementation: Implementation<Context>): void
	/** Declare a concurrent test that uses one or more macros. Additional arguments are passed to the macro. */
  <T extends any[]>(title: string, macros: OneOrMoreMacros<T, Context>, ...rest: T): void
	/** Declare a concurrent test that uses one or more macros. The macro is responsible for generating a unique test title. */
  <T extends any[]>(macros: OneOrMoreMacros<T, Context>, ...rest: T): void
  //#endregion

  serial (title: string, implementation: Implementation<Context>): void
	/** Declare a concurrent test that uses one or more macros. Additional arguments are passed to the macro. */
  serial<T extends any[]> (title: string, macros: OneOrMoreMacros<T, Context>, ...rest: T): void
	/** Declare a concurrent test that uses one or more macros. The macro is responsible for generating a unique test title. */
  serial<T extends any[]> (macros: OneOrMoreMacros<T, Context>, ...rest: T): void

  macro<Args extends any[]> (cb: (...args: Args) => ([(title: string | undefined) => string, (t: ExecutionContext<Context>) => Promise<void>] | ((t: ExecutionContext<Context>) => Promise<void>))): (test: ExecutionContext<Context>, ...args: Args) => Promise<void> & {
    title (givenTitle: string | undefined, ...args: Args): string;
  }

  beforeAll (cb: (t: ExecutionContext<Context>) => Promise<void>): void
  beforeEach (cb: (t: ExecutionContext<Context>) => Promise<void>): void
  context<T extends object> (cb: (t: ExecutionContext<Context>) => Promise<T>): TestInterface<Context & T>
  suite (title: string, cb: (test: TestInterface<Context>) => void): void

  runSerially (): void

  // TODO add teardownEach
}
function createTestInterface<Context> (opts: {
  titlePrefix: string | undefined,
  separator: string | undefined,
  mustDoSerial: boolean,
  automaticallyDoSerial: boolean,
  beforeEachFunctions: Function[]
}): TestInterface<Context> {
  const { titlePrefix, separator = ' > ' } = opts
  const beforeEachFunctions = [...(opts.beforeEachFunctions ?? [])]
  let { mustDoSerial, automaticallyDoSerial } = opts
  let hookDeclared = false
  let suiteOrTestDeclared = false
  function computeTitle (title: string | undefined) {
    assert(title)
    // return `${ titlePrefix }${ separator }${ title }`;
    if (titlePrefix != null && title != null) { // tslint:disable-line:strict-type-predicates
      return `${ titlePrefix }${ separator }${ title }`
    }
    if (titlePrefix == null && title != null) { // tslint:disable-line:strict-type-predicates
      return title
    }
  }
  function parseArgs (args: any[]) {
    const title = typeof args[0] === 'string' ? args.shift() as string : undefined
    const macros = typeof args[0] === 'function' ? [args.shift() as Function] : Array.isArray(args[0]) ? args.shift() as Function[] : []
    return { title, macros, args }
  }
  function assertOrderingForDeclaringTest () {
    suiteOrTestDeclared = true
  }
  function assertOrderingForDeclaringHook () {
    if (suiteOrTestDeclared) {
      throw new Error('Hooks must be declared before declaring sub-suites or tests')
    }
    hookDeclared = true
  }
  /**
   * @param avaDeclareFunction either test or test.serial
   */
  function declareTest (title: string | undefined, macros: Function[], avaDeclareFunction: Function, args: any[]) {
    const wrappedMacros = macros.map(macro => {
      return async function (t: ExecutionContext<Context>, ...args: any[]) {
        return concurrencyLimiter(async () => {
          let i = 0
          for (const func of beforeEachFunctions) {
            await func(t)
            i++
          }
          return macro(t, ...args)
        })
      }
    })
    const computedTitle = computeTitle(title)
    avaDeclareFunction(computedTitle, wrappedMacros, ...args)
  }
  function test (...inputArgs: any[]) {
    assertOrderingForDeclaringTest()
    // TODO is this safe to disable?
    // X parallel tests will each invoke the beforeAll hook, but once()ification means each invocation will return the same promise, and tests cannot
    // start till it finishes.
    // HOWEVER if it returns a single shared state, can tests concurrently use this shared state?
    // if(!automaticallyDoSerial && mustDoSerial) throw new Error('Cannot declare non-serial tests because you have declared a beforeAll() hook for this test suite.');
    const { args, macros, title } = parseArgs(inputArgs)
    return declareTest(title, macros, automaticallyDoSerial ? avaTest.serial : avaTest, args)
  }
  test.serial = function (...inputArgs: any[]) {
    assertOrderingForDeclaringTest()
    const { args, macros, title } = parseArgs(inputArgs)
    return declareTest(title, macros, avaTest.serial, args)
  }
  test.beforeEach = function (cb: (test: ExecutionContext<Context>) => Promise<void>) {
    assertOrderingForDeclaringHook()
    beforeEachFunctions.push(cb)
  }
  test.context = function (cb: (test: ExecutionContext<Context>) => Promise<any>) {
    assertOrderingForDeclaringHook()
    beforeEachFunctions.push(async (t: ExecutionContext<Context>) => {
      const addedContextFields = await cb(t)
      Object.assign(t.context, addedContextFields)
    })
    return test
  }
  test.beforeAll = function (cb: (test: ExecutionContext<Context>) => Promise<void>) {
    assertOrderingForDeclaringHook()
    mustDoSerial = true
    beforeEachFunctions.push(once(cb))
  }
  test.macro = function<Args extends any[]>(cb: (...args: Args) => [(title: string | undefined) => string, (t: ExecutionContext<Context>) => Promise<void>] | ((t: ExecutionContext<Context>) => Promise<void>)) {
    function macro (testInterface: ExecutionContext<Context>, ...args: Args) {
      const ret = cb(...args)
      const [, macroFunction] = Array.isArray(ret) ? ret : [, ret]
      return macroFunction(testInterface)
    }
    macro.title = function (givenTitle: string | undefined, ...args: Args) {
      const ret = cb(...args)
      return Array.isArray(ret) ? ret[0](givenTitle) : givenTitle
    }
    return macro
  }
  test.suite = function (title: string, cb: (test: TestInterface<Context>) => void) {
    const newApi = createTestInterface<Context>({
      mustDoSerial,
      automaticallyDoSerial,
      separator,
      titlePrefix: computeTitle(title),
      beforeEachFunctions
    })
    cb(newApi)
  }
  test.runSerially = function () {
    automaticallyDoSerial = true
  }
  return test as any
}
