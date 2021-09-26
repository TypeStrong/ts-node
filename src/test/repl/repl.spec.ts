import ts = require('typescript');
import semver = require('semver');
import * as exp from 'expect';
import { expect } from 'chai';
import {
  CMD_TS_NODE_WITH_PROJECT_FLAG,
  contextTsNodeUnderTest,
  TEST_DIR,
} from '../helpers';
import { createExec, createExecTester } from '../exec-helpers';
import { upstreamTopLevelAwaitTests } from './node-repl-tla';
import { _test } from '../testlib';
import { contextReplHelpers, contextReplApiTester } from './helpers';

const test = _test
  .context(contextTsNodeUnderTest)
  .context(contextReplHelpers)
  .context(contextReplApiTester);

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
  expect(err).to.equal(null);
  expect(stdout).to.equal('> 123\n' + 'undefined\n' + '> ');
});

test('REPL has command to get type information', async () => {
  const execPromise = exec(`${CMD_TS_NODE_WITH_PROJECT_FLAG} --interactive`);
  execPromise.child.stdin!.end('\nconst a = 123\n.type a');
  const { err, stdout } = await execPromise;
  expect(err).to.equal(null);
  expect(stdout).to.equal(
    '> undefined\n' + '> undefined\n' + '> const a: 123\n' + '> '
  );
});

// Serial because it's timing-sensitive
test.serial('REPL can be configured on `start`', async (t) => {
  const prompt = '#> ';

  const { stdout, stderr } = await t.context.executeInRepl('const x = 3', {
    registerHooks: true,
    startOptions: {
      prompt,
      ignoreUndefined: true,
    },
  });

  expect(stderr).to.equal('');
  expect(stdout).to.equal(`${prompt}${prompt}`);
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
        startOptions: {
          useGlobal: false,
        },
      }
    );

    expect(stderr).to.equal('');
    expect(stdout).to.equal(`> undefined\n> 1\nundefined\n> `);
  }
);

// Serial because it's timing-sensitive
test.serial('REPL can be created via API', async (t) => {
  const { stdout, stderr } = await t.context.replApiTester({
    input: '\nconst a = 123\n.type a\n',
  });
  expect(stderr).to.equal('');
  expect(stdout).to.equal(
    '> undefined\n' + '> undefined\n' + '> const a: 123\n' + '> '
  );
});

test.suite('top level await', (_test) => {
  const compilerOptions = {
    target: 'es2018',
  };
  const test = _test.context(async (t) => {
    return { executeInTlaRepl };

    function executeInTlaRepl(input: string, waitMs = 1000) {
      return t.context.executeInRepl(
        input
          .split('\n')
          .map((line) => line.trim())
          // Restore newline once https://github.com/nodejs/node/pull/39392 is merged
          .join(''),
        {
          registerHooks: true,
          waitMs,
          createServiceOpts: {
            experimentalReplAwait: true,
            compilerOptions,
          },
          startOptions: { useGlobal: false },
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

      const { stdout, stderr } = await t.context.executeInTlaRepl(script);
      expect(stderr).to.equal('');
      expect(stdout).to.equal('> 1\n2\n3\na\nb\n6\n> ');
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
          6000
        );

        expect(stderr).to.equal('');

        const elapsedTimeString = stdout
          .split('\n')[0]
          .replace('> ', '')
          .trim();
        exp(elapsedTimeString).toMatch(/^\d+$/);
        const elapsedTime = Number(elapsedTimeString);
        expect(elapsedTime).to.be.gte(awaitMs - 50);
        expect(elapsedTime).to.be.lte(awaitMs + 100);
      }
    );

    // Serial because it's timing-sensitive
    test.serial(
      'should not wait until promise is settled when not using await at top level',
      async (t) => {
        const script = `
          const startTime = new Date().getTime();
          (async () => await new Promise((r) => setTimeout(() => r(1), ${1000})))();
          const endTime = new Date().getTime();
          endTime - startTime;
        `;
        const { stdout, stderr } = await t.context.executeInTlaRepl(script);

        expect(stderr).to.equal('');

        const ellapsedTime = Number(
          stdout.split('\n')[0].replace('> ', '').trim()
        );
        expect(ellapsedTime).to.be.gte(0);
        expect(ellapsedTime).to.be.lte(10);
      }
    );

    // Serial because it's timing-sensitive
    test.serial(
      'should error with typing information when awaited result has type mismatch',
      async (t) => {
        const { stdout, stderr } = await t.context.executeInTlaRepl(
          'const x: string = await 1'
        );

        expect(stdout).to.equal('> > ');
        expect(stderr.replace(/\r\n/g, '\n')).to.equal(
          '<repl>.ts(2,7): error TS2322: ' +
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
          `const {foo} = await import('./tests/repl/tla-import');`
        );

        expect(stdout).to.equal('> > ');
        expect(stderr.replace(/\r\n/g, '\n')).to.equal(
          'tests/repl/tla-import.ts(1,14): error TS2322: ' +
            (semver.gte(ts.version, '4.0.0')
              ? `Type 'number' is not assignable to type 'string'.\n`
              : `Type '1' is not assignable to type 'string'.\n`) +
            '\n'
        );
      }
    );

    test('should pass upstream test cases', async (t) => {
      const { tsNodeUnderTest } = t.context;
      upstreamTopLevelAwaitTests({ TEST_DIR, tsNodeUnderTest });
    });
  } else {
    test('should throw error when attempting to use top level await on TS < 3.8', async (t) => {
      exp(t.context.executeInTlaRepl('', 1000)).rejects.toThrow(
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
      exp(stdout).not.toContain(diagnosticMessage);
    });
    test('interactive repl should not ignore them if they occur in other files', async (t) => {
      const { stdout, stderr } = await execTester({
        flags: '-i',
        stdin: `import './repl-ignored-diagnostics/index.ts';\n`,
      });
      exp(stderr).toContain(diagnosticMessage);
    });
    test('[stdin] should not ignore them', async (t) => {
      const { stdout, stderr } = await execTester({
        stdin: code,
        expectError: true,
      });
      exp(stderr).toContain(diagnosticMessage);
    });
    test('[eval] should not ignore them', async (t) => {
      const { stdout, stderr } = await execTester({
        flags: `-e "${code.replace(/\n/g, '')}"`,
        expectError: true,
      });
      exp(stderr).toContain(diagnosticMessage);
    });
  }
);
