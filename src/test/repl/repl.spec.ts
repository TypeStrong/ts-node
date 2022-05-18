import { context, expect } from '../testlib';
import { delay, resetNodeEnvironment, ts } from '../helpers';
import semver = require('semver');
import {
  CMD_TS_NODE_WITH_PROJECT_FLAG,
  ctxTsNode,
  getStream,
  TEST_DIR,
} from '../helpers';
import { createExec, createExecTester } from '../exec-helpers';
import { upstreamTopLevelAwaitTests } from './node-repl-tla';
import {
  ctxRepl,
  macroReplNoErrorsAndStdoutContains,
  macroReplStderrContains,
} from './helpers';

const test = context(ctxTsNode).context(ctxRepl);
test.runSerially();
test.beforeEach(async (t) => {
  t.teardown(() => {
    resetNodeEnvironment();
    // Useful for debugging memory leaks.  Leaving in case I need it again.
    // global.gc(); // Requires adding nodeArguments: ['--expose-gc'] to ava config
    // console.dir(process.memoryUsage().heapUsed / 1000 / 1000);
  });
});

const exec = createExec({
  cwd: TEST_DIR,
});

const execTester = createExecTester({
  cmd: CMD_TS_NODE_WITH_PROJECT_FLAG,
  exec,
});

test('should run REPL when --interactive passed and stdin is not a TTY', async () => {
  const execPromise = exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} --interactive`);
  execPromise.child.stdin!.end('console.log("123")\n');
  const { err, stdout } = await execPromise;
  expect(err).toBe(null);
  expect(stdout).toBe('> 123\n' + 'undefined\n' + '> ');
});

test('should echo a value when using the swc transpiler', async () => {
  const execPromise = exec(
    `${CMD_TS_NODE_WITH_PROJECT_FLAG} --interactive  --transpiler ts-node/transpilers/swc-experimental`
  );
  execPromise.child.stdin!.end('400\n401\n');
  const { err, stdout } = await execPromise;
  expect(err).toBe(null);
  expect(stdout).toBe('> 400\n> 401\n> ');
});

test('REPL has command to get type information', async () => {
  const execPromise = exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} --interactive`);
  execPromise.child.stdin!.end('\nconst a = 123\n.type a');
  const { err, stdout } = await execPromise;
  expect(err).toBe(null);
  expect(stdout).toBe(
    '> undefined\n' + '> undefined\n' + '> const a: 123\n' + '> '
  );
});

// Serial because it's timing-sensitive
test.serial('REPL can be configured on `start`', async (t) => {
  const prompt = '#> ';

  const { stdout, stderr } = await t.context.executeInRepl(
    `const x = 3\n'done'`,
    {
      waitPattern: "'done'",
      registerHooks: true,
      startInternalOptions: {
        prompt,
        ignoreUndefined: true,
      },
    }
  );

  expect(stderr).toBe('');
  expect(stdout).toBe(`${prompt}${prompt}'done'\n`);
});

// Serial because it's timing-sensitive
test.serial(
  'REPL uses a different context when `useGlobal` is false',
  async (t) => {
    const { stdout, stderr } = await t.context.executeInRepl(
      // No error when re-declaring x
      'const x = 3\n' +
        // console.log ouput will end up in the stream and not in test output
        'console.log(1)\n',
      {
        registerHooks: true,
        waitPattern: `> undefined\n> 1\nundefined\n> `,
        startInternalOptions: {
          useGlobal: false,
        },
      }
    );

    expect(stderr).toBe('');
    expect(stdout).toBe(`> undefined\n> 1\nundefined\n> `);
  }
);

// Serial because it's timing-sensitive
test.serial('REPL can be created via API', async (t) => {
  const { stdout, stderr } = await t.context.executeInRepl(
    `\nconst a = 123\n.type a\n`,
    {
      registerHooks: true,
      waitPattern: '123\n> ',
    }
  );
  expect(stderr).toBe('');
  expect(stdout).toBe(
    '> undefined\n' + '> undefined\n' + '> const a: 123\n' + '> '
  );
});

test.suite('top level await', ({ context }) => {
  const compilerOptions = {
    target: 'es2018',
  };
  const test = context(async (t) => {
    return { executeInTlaRepl };

    function executeInTlaRepl(input: string, waitPattern?: string | RegExp) {
      return t.context.executeInRepl(
        input
          .split('\n')
          .map((line) => line.trim())
          // Restore newline once https://github.com/nodejs/node/pull/39392 is merged
          .join(''),
        {
          registerHooks: true,
          waitPattern,
          createServiceOpts: {
            experimentalReplAwait: true,
            compilerOptions,
          },
          startInternalOptions: { useGlobal: false },
        }
      );
    }
  });

  if (semver.gte(ts.version, '3.8.0')) {
    // Serial because it's timing-sensitive
    test.serial('should allow evaluating top level await', async (t) => {
      const script = `
        const x: number = await new Promise((r) => r(1));
        for await (const x of [1,2,3]) { console.log(x) };
        for (const x of ['a', 'b']) { await x; console.log(x) };
        class Foo {}; await 1;
        function Bar() {}; await 2;
        const {y} = await ({y: 2});
        const [z] = await [3];
        x + y + z;
      `;

      const { stdout, stderr } = await t.context.executeInTlaRepl(
        script,
        '6\n> '
      );
      expect(stderr).toBe('');
      expect(stdout).toBe('> 1\n2\n3\na\nb\n6\n> ');
    });

    // Serial because it's timing-sensitive
    test.serial(
      'should wait until promise is settled when awaiting at top level',
      async (t) => {
        const awaitMs = 500;
        const script = `
          const startTime = new Date().getTime();
          await new Promise((r) => setTimeout(() => r(1), ${awaitMs}));
          const endTime = new Date().getTime();
          endTime - startTime;
        `;
        const { stdout, stderr } = await t.context.executeInTlaRepl(
          script,
          /\d+\n/
        );

        expect(stderr).toBe('');

        const elapsedTimeString = stdout
          .split('\n')[0]
          .replace('> ', '')
          .trim();
        expect(elapsedTimeString).toMatch(/^\d+$/);
        const elapsedTime = Number(elapsedTimeString);
        expect(elapsedTime).toBeGreaterThanOrEqual(awaitMs - 50);
        // When CI is taxed, the time may be *much* greater than expected.
        // I can't think of a case where the time being *too high* is a bug
        // that this test can catch.  So I've made this check very loose.
        expect(elapsedTime).toBeLessThanOrEqual(awaitMs + 10e3);
      }
    );

    // Serial because it's timing-sensitive
    test.serial(
      'should not wait until promise is settled when not using await at top level',
      async (t) => {
        const script = `
          const startTime = new Date().getTime();
          (async () => await new Promise((r) => setTimeout(() => r(1), ${5000})))();
          const endTime = new Date().getTime();
          endTime - startTime;
        `;
        const { stdout, stderr } = await t.context.executeInTlaRepl(
          script,
          /\d+\n/
        );

        expect(stderr).toBe('');

        const ellapsedTime = Number(
          stdout.split('\n')[0].replace('> ', '').trim()
        );
        expect(ellapsedTime).toBeGreaterThanOrEqual(0);
        // Should ideally be instantaneous; leave wiggle-room for slow CI
        expect(ellapsedTime).toBeLessThanOrEqual(100);
      }
    );

    // Serial because it's timing-sensitive
    test.serial(
      'should error with typing information when awaited result has type mismatch',
      async (t) => {
        const { stdout, stderr } = await t.context.executeInTlaRepl(
          'const x: string = await 1',
          'error'
        );

        expect(stdout).toBe('> > ');
        expect(stderr.replace(/\r\n/g, '\n')).toBe(
          '<repl>.ts(4,7): error TS2322: ' +
            (semver.gte(ts.version, '4.0.0')
              ? `Type 'number' is not assignable to type 'string'.\n`
              : `Type '1' is not assignable to type 'string'.\n`) +
            '\n'
        );
      }
    );

    // Serial because it's timing-sensitive
    test.serial(
      'should error with typing information when importing a file with type errors',
      async (t) => {
        const { stdout, stderr } = await t.context.executeInTlaRepl(
          `const {foo} = await import('./repl/tla-import');`,
          'error'
        );

        expect(stdout).toBe('> > ');
        expect(stderr.replace(/\r\n/g, '\n')).toBe(
          'repl/tla-import.ts(1,14): error TS2322: ' +
            (semver.gte(ts.version, '4.0.0')
              ? `Type 'number' is not assignable to type 'string'.\n`
              : `Type '1' is not assignable to type 'string'.\n`) +
            '\n'
        );
      }
    );

    test('should pass upstream test cases', async (t) => {
      const { tsNodeUnderTest } = t.context;
      await upstreamTopLevelAwaitTests({ TEST_DIR, tsNodeUnderTest });
    });
  } else {
    test('should throw error when attempting to use top level await on TS < 3.8', async (t) => {
      expect(t.context.executeInTlaRepl('')).rejects.toThrow(
        'Experimental REPL await is not compatible with TypeScript versions older than 3.8'
      );
    });
  }
});

test.suite(
  'REPL ignores diagnostics that are annoying in interactive sessions',
  (test) => {
    const code = `function foo() {};\nfunction foo() {return 123};\nconsole.log(foo());\n`;
    const diagnosticMessage = `Duplicate function implementation`;
    test('interactive repl should ignore them', async (t) => {
      const { stdout, stderr } = await execTester({
        flags: '-i',
        stdin: code,
      });
      expect(stdout).not.toContain(diagnosticMessage);
    });
    test('interactive repl should not ignore them if they occur in other files', async (t) => {
      const { stdout, stderr } = await execTester({
        flags: '-i',
        stdin: `import './repl-ignored-diagnostics/index.ts';\n`,
      });
      expect(stderr).toContain(diagnosticMessage);
    });
    test('[stdin] should not ignore them', async (t) => {
      const { stdout, stderr } = await execTester({
        stdin: code,
        expectError: true,
      });
      expect(stderr).toContain(diagnosticMessage);
    });
    test('[eval] should not ignore them', async (t) => {
      const { stdout, stderr } = await execTester({
        flags: `-e "${code.replace(/\n/g, '')}"`,
        expectError: true,
      });
      expect(stderr).toContain(diagnosticMessage);
    });
  }
);

test.suite(
  'REPL inputs are syntactically independent of each other',
  (test) => {
    // Serial because they're timing-sensitive
    test.runSerially();

    test('arithmetic operators are independent of previous values', async (t) => {
      const { stdout, stderr } = await t.context.executeInRepl(
        `9
          + 3
          7
          - 3
          3
          * 7\n.break
          100
          / 2\n.break
          5
          ** 2\n.break
          console.log('done!')
          `,
        {
          registerHooks: true,
          startInternalOptions: { useGlobal: false },
          waitPattern: 'done!\nundefined\n>',
        }
      );
      expect(stdout).not.toContain('12');
      expect(stdout).not.toContain('4');
      expect(stdout).not.toContain('21');
      expect(stdout).not.toContain('50');
      expect(stdout).not.toContain('25');
      expect(stdout).toContain('3');
      expect(stdout).toContain('-3');
    });

    test('automatically inserted semicolons do not appear in error messages at the end', async (t) => {
      const { stdout, stderr } = await t.context.executeInRepl(
        `(
          a
          console.log('done!')`,
        {
          registerHooks: true,
          startInternalOptions: { useGlobal: false },
          waitPattern: 'done!\nundefined\n>',
        }
      );
      expect(stderr).toContain("error TS1005: ')' expected.");
      expect(stderr).not.toContain(';');
    });

    test('automatically inserted semicolons do not appear in error messages at the start', async (t) => {
      const { stdout, stderr } = await t.context.executeInRepl(
        `)
          console.log('done!')`,
        {
          registerHooks: true,
          startInternalOptions: { useGlobal: false },
          waitPattern: 'done!\nundefined\n>',
        }
      );
      expect(stderr).toContain(
        'error TS1128: Declaration or statement expected.'
      );
      expect(stderr).toContain(')');
      expect(stderr).not.toContain(';');
    });

    test('automatically inserted semicolons do not break function calls', async (t) => {
      const { stdout, stderr } = await t.context.executeInRepl(
        `function foo(a: number) {
              return a + 1;
          }
          foo(
            1
          )`,
        {
          registerHooks: true,
          startInternalOptions: { useGlobal: false },
          waitPattern: '2\n>',
        }
      );
      expect(stderr).toBe('');
      expect(stdout).toContain('2');
    });

    test('automatically inserted semicolons do not affect subsequent line numbers', async (t) => {
      // If first line of input ends in a semicolon, should not add a second semicolon.
      // That will cause an extra blank line in the compiled output which will
      // offset the stack line number.
      const { stdout, stderr } = await t.context.executeInRepl(
        `1;
          new Error().stack!.split('\\n')[1]
          console.log('done!')`,
        {
          registerHooks: true,
          startInternalOptions: { useGlobal: false },
          waitPattern: 'done!',
        }
      );
      expect(stderr).toBe('');
      expect(stdout).toContain(":1:1'\n");
    });
  }
);

test.suite('Multiline inputs and RECOVERY_CODES', (test) => {
  test.runSerially();
  test(
    'multiline function args declaration',
    macroReplNoErrorsAndStdoutContains,
    `
      function myFn(
        a: string,
        b: string
      ) {
        return a + ' ' + b
      }
      myFn('test', '!')
    `,
    'test !'
  );

  test(
    'Conditional recovery codes: this one-liner *should* raise an error; should not be recoverable',
    macroReplStderrContains,
    `
      (a: any) => a = null;
    `,
    'error TS',
    {
      createServiceOpts: { compilerOptions: { strictNullChecks: false } },
    }
  );
});

test.suite('REPL works with traceResolution', (test) => {
  test.serial(
    'startup traces should print before the prompt appears when traceResolution is enabled',
    async (t) => {
      const repl = t.context.createReplViaApi({
        registerHooks: false,
        createServiceOpts: {
          compilerOptions: {
            traceResolution: true,
          },
        },
      });

      repl.replService.start();

      repl.stdin.end();

      await delay(3e3);

      repl.stdout.end();
      const stdout = await getStream(repl.stdout);

      expect(stdout).toContain('======== Resolving module');
      expect(stdout.endsWith('> ')).toBe(true);
    }
  );

  test.serial(
    'traces should NOT appear when traceResolution is not enabled',
    async (t) => {
      const { stdout, stderr } = await t.context.executeInRepl('1', {
        registerHooks: true,
        startInternalOptions: { useGlobal: false },
        waitPattern: '1\n>',
      });
      expect(stderr).toBe('');
      expect(stdout).not.toContain('======== Resolving module');
    }
  );
});

test.suite('REPL declares types for node built-ins within REPL', (test) => {
  test.runSerially();
  test('enabled when typechecking', async (t) => {
    const { stdout, stderr } = await t.context.executeInRepl(
      `util.promisify(setTimeout)("should not be a string" as string)
      type Duplex = stream.Duplex
      const s = stream
      'done'`,
      {
        registerHooks: true,
        waitPattern: `done`,
        startInternalOptions: {
          useGlobal: false,
        },
      }
    );

    // Assert that we receive a typechecking error about improperly using
    // `util.promisify` but *not* an error about the absence of `util`
    expect(stderr).not.toMatch("Cannot find name 'util'");
    expect(stderr).toMatch(
      "Argument of type 'string' is not assignable to parameter of type 'number'"
    );
    // Assert that both types and values can be used without error
    expect(stderr).not.toMatch("Cannot find namespace 'stream'");
    expect(stderr).not.toMatch("Cannot find name 'stream'");
    expect(stdout).toMatch(`done`);
  });

  test('disabled in transpile-only mode, to avoid breaking third-party SWC transpiler which rejects `declare import` syntax', async (t) => {
    const { stdout, stderr } = await t.context.executeInRepl(
      `type Duplex = stream.Duplex
      const s = stream
      'done'`,
      {
        createServiceOpts: {
          swc: true,
        },
        registerHooks: true,
        waitPattern: `done`,
        startInternalOptions: {
          useGlobal: false,
        },
      }
    );

    // Assert that we do not get errors about `declare import` syntax from swc
    expect(stdout).toBe("> undefined\n> undefined\n> 'done'\n");
    expect(stderr).toBe('');
  });
});

test.suite('REPL treats object literals and block scopes correctly', (test) => {
  test(
    'repl should treat { key: 123 } as object literal',
    macroReplNoErrorsAndStdoutContains,
    '{ key: 123 }',
    '{ key: 123 }'
  );
  test(
    'repl should treat ({ key: 123 }) as object literal',
    macroReplNoErrorsAndStdoutContains,
    '({ key: 123 })',
    '{ key: 123 }'
  );
  test(
    'repl should treat ({ let v = 0; v; }) as object literal and error',
    macroReplStderrContains,
    '({ let v = 0; v; })',
    semver.satisfies(ts.version, '2.7')
      ? 'error TS2304'
      : 'No value exists in scope for the shorthand property'
  );
  test(
    'repl should treat { let v = 0; v; } as block scope',
    macroReplNoErrorsAndStdoutContains,
    '{ let v = 0; v; }',
    '0'
  );
  test.suite('extra', (test) => {
    test.skipIf(semver.satisfies(ts.version, '2.7'));
    test(
      'repl should treat { key: 123 }; as block scope',
      macroReplNoErrorsAndStdoutContains,
      '{ key: 123 };',
      '123'
    );
    test(
      'repl should treat {\\nkey: 123\\n}; as block scope',
      macroReplNoErrorsAndStdoutContains,
      '{\nkey: 123\n};',
      '123'
    );
    test(
      'repl should treat { key: 123 }[] as block scope (edge case)',
      macroReplNoErrorsAndStdoutContains,
      '{ key: 123 }[]',
      '[]'
    );
  });
  test.suite('multiline', (test) => {
    test(
      'repl should treat {\\nkey: 123\\n} as object literal',
      macroReplNoErrorsAndStdoutContains,
      '{\nkey: 123\n}',
      '{ key: 123 }'
    );
    test(
      'repl should treat ({\\nkey: 123\\n}) as object literal',
      macroReplNoErrorsAndStdoutContains,
      '({\nkey: 123\n})',
      '{ key: 123 }'
    );
    test(
      'repl should treat ({\\nlet v = 0;\\nv;\\n}) as object literal and error',
      macroReplStderrContains,
      '({\nlet v = 0;\nv;\n})',
      semver.satisfies(ts.version, '2.7')
        ? 'error TS2304'
        : 'No value exists in scope for the shorthand property'
    );
    test(
      'repl should treat {\\nlet v = 0;\\nv;\\n} as block scope',
      macroReplNoErrorsAndStdoutContains,
      '{\nlet v = 0;\nv;\n}',
      '0'
    );
  });
  test.suite('property access', (test) => {
    test(
      'repl should treat { key: 123 }.key as object literal property access',
      macroReplNoErrorsAndStdoutContains,
      '{ key: 123 }.key',
      '123'
    );
    test(
      'repl should treat { key: 123 }["key"] as object literal indexed access',
      macroReplNoErrorsAndStdoutContains,
      '{ key: 123 }["key"]',
      '123'
    );
    test(
      'repl should treat { key: 123 }.foo as object literal non-existent property access',
      macroReplStderrContains,
      '{ key: 123 }.foo',
      "Property 'foo' does not exist on type"
    );
    test(
      'repl should treat { key: 123 }["foo"] as object literal non-existent indexed access',
      macroReplStderrContains,
      '{ key: 123 }["foo"]',
      semver.satisfies(ts.version, '2.7')
        ? 'error TS7017'
        : "Property 'foo' does not exist on type"
    );
  });
});
