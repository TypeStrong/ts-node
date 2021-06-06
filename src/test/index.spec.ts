import { test, TestInterface } from './testlib';
import { expect } from 'chai';
import * as exp from 'expect';
import {
  ChildProcess,
  exec as childProcessExec,
  ExecException,
  ExecOptions,
} from 'child_process';
import { dirname, join, resolve, sep as pathSep } from 'path';
import { homedir, tmpdir } from 'os';
import semver = require('semver');
import ts = require('typescript');
import proxyquire = require('proxyquire');
import type * as tsNodeTypes from '../index';
import * as fs from 'fs';
import {
  unlinkSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  fstat,
  copyFileSync,
  writeFileSync,
} from 'fs';
import { NodeFS, npath } from '@yarnpkg/fslib';
import * as promisify from 'util.promisify';
import { sync as rimrafSync } from 'rimraf';
import type _createRequire from 'create-require';
const createRequire: typeof _createRequire = require('create-require');
import { pathToFileURL } from 'url';
import type * as Module from 'module';
import { PassThrough } from 'stream';
import * as getStream from 'get-stream';
import { once } from 'lodash';

const xfs = new NodeFS(fs);

type TestExecReturn = {
  stdout: string;
  stderr: string;
  err: null | ExecException;
};
function exec(
  cmd: string,
  opts: ExecOptions = {}
): Promise<TestExecReturn> & { child: ChildProcess } {
  let childProcess!: ChildProcess;
  return Object.assign(
    new Promise<TestExecReturn>((resolve, reject) => {
      childProcess = childProcessExec(
        cmd,
        {
          cwd: TEST_DIR,
          ...opts,
        },
        (error, stdout, stderr) => {
          resolve({ err: error, stdout, stderr });
        }
      );
    }),
    {
      child: childProcess,
    }
  );
}

const ROOT_DIR = resolve(__dirname, '../..');
const DIST_DIR = resolve(__dirname, '..');
const TEST_DIR = join(__dirname, '../../tests');
const PROJECT = join(TEST_DIR, 'tsconfig.json');
const BIN_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node');
const BIN_SCRIPT_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node-script');
const BIN_CWD_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node-cwd');

const SOURCE_MAP_REGEXP = /\/\/# sourceMappingURL=data:application\/json;charset=utf\-8;base64,[\w\+]+=*$/;

// `createRequire` does not exist on older node versions
const testsDirRequire = createRequire(join(TEST_DIR, 'index.js'));

// Set after ts-node is installed locally
let { register, create, VERSION, createRepl }: typeof tsNodeTypes = {} as any;

// Pack and install ts-node locally, necessary to test package "exports"
test.beforeAll(async () => {
  rimrafSync(join(TEST_DIR, 'node_modules'));
  await promisify(childProcessExec)(`npm install`, { cwd: TEST_DIR });
  const packageLockPath = join(TEST_DIR, 'package-lock.json');
  existsSync(packageLockPath) && unlinkSync(packageLockPath);
  ({ register, create, VERSION, createRepl } = testsDirRequire('ts-node'));
});

test.suite('ts-node', (test) => {
  const cmd = `"${BIN_PATH}" --project "${PROJECT}"`;
  const cmdNoProject = `"${BIN_PATH}"`;

  test('should export the correct version', () => {
    expect(VERSION).to.equal(require('../../package.json').version);
  });
  test('should export all CJS entrypoints', () => {
    // Ensure our package.json "exports" declaration allows `require()`ing all our entrypoints
    // https://github.com/TypeStrong/ts-node/pull/1026

    testsDirRequire.resolve('ts-node');

    // only reliably way to ask node for the root path of a dependency is Path.resolve(require.resolve('ts-node/package'), '..')
    testsDirRequire.resolve('ts-node/package');
    testsDirRequire.resolve('ts-node/package.json');

    // All bin entrypoints for people who need to augment our CLI: `node -r otherstuff ./node_modules/ts-node/dist/bin`
    testsDirRequire.resolve('ts-node/dist/bin');
    testsDirRequire.resolve('ts-node/dist/bin.js');
    testsDirRequire.resolve('ts-node/dist/bin-transpile');
    testsDirRequire.resolve('ts-node/dist/bin-transpile.js');
    testsDirRequire.resolve('ts-node/dist/bin-script');
    testsDirRequire.resolve('ts-node/dist/bin-script.js');
    testsDirRequire.resolve('ts-node/dist/bin-cwd');
    testsDirRequire.resolve('ts-node/dist/bin-cwd.js');

    // Must be `require()`able obviously
    testsDirRequire.resolve('ts-node/register');
    testsDirRequire.resolve('ts-node/register/files');
    testsDirRequire.resolve('ts-node/register/transpile-only');
    testsDirRequire.resolve('ts-node/register/type-check');

    // `node --loader ts-node/esm`
    testsDirRequire.resolve('ts-node/esm');
    testsDirRequire.resolve('ts-node/esm.mjs');
    testsDirRequire.resolve('ts-node/esm/transpile-only');
    testsDirRequire.resolve('ts-node/esm/transpile-only.mjs');

    testsDirRequire.resolve('ts-node/transpilers/swc-experimental');

    testsDirRequire.resolve('ts-node/node10/tsconfig.json');
    testsDirRequire.resolve('ts-node/node12/tsconfig.json');
    testsDirRequire.resolve('ts-node/node14/tsconfig.json');
    testsDirRequire.resolve('ts-node/node16/tsconfig.json');
  });

  test.suite('cli', (test) => {
    test('should execute cli', async () => {
      const { err, stdout } = await exec(`${cmd} hello-world`);
      expect(err).to.equal(null);
      expect(stdout).to.equal('Hello, world!\n');
    });

    test('shows usage via --help', async () => {
      const { err, stdout } = await exec(`${cmdNoProject} --help`);
      expect(err).to.equal(null);
      expect(stdout).to.match(/Usage: ts-node /);
    });
    test('shows version via -v', async () => {
      const { err, stdout } = await exec(`${cmdNoProject} -v`);
      expect(err).to.equal(null);
      expect(stdout.trim()).to.equal(
        'v' + testsDirRequire('ts-node/package').version
      );
    });
    test('shows version of compiler via -vv', async () => {
      const { err, stdout } = await exec(`${cmdNoProject} -vv`);
      expect(err).to.equal(null);
      expect(stdout.trim()).to.equal(
        `ts-node v${testsDirRequire('ts-node/package').version}\n` +
          `node ${process.version}\n` +
          `compiler v${testsDirRequire('typescript/package').version}`
      );
    });

    test('should register via cli', async () => {
      const { err, stdout } = await exec(
        `node -r ts-node/register hello-world.ts`,
        {
          cwd: TEST_DIR,
        }
      );
      expect(err).to.equal(null);
      expect(stdout).to.equal('Hello, world!\n');
    });

    test('should execute cli with absolute path', async () => {
      const { err, stdout } = await exec(
        `${cmd} "${join(TEST_DIR, 'hello-world')}"`
      );
      expect(err).to.equal(null);
      expect(stdout).to.equal('Hello, world!\n');
    });

    test('should print scripts', async () => {
      const { err, stdout } = await exec(
        `${cmd} -pe "import { example } from './complex/index';example()"`
      );
      expect(err).to.equal(null);
      expect(stdout).to.equal('example\n');
    });

    test('should provide registered information globally', async () => {
      const { err, stdout } = await exec(`${cmd} env`);
      expect(err).to.equal(null);
      expect(stdout).to.equal('object\n');
    });

    test('should provide registered information on register', async () => {
      const { err, stdout } = await exec(`node -r ts-node/register env.ts`, {
        cwd: TEST_DIR,
      });
      expect(err).to.equal(null);
      expect(stdout).to.equal('object\n');
    });

    if (semver.gte(ts.version, '1.8.0')) {
      test('should allow js', async () => {
        const { err, stdout } = await exec(
          [
            cmd,
            '-O "{\\"allowJs\\":true}"',
            '-pe "import { main } from \'./allow-js/run\';main()"',
          ].join(' ')
        );
        expect(err).to.equal(null);
        expect(stdout).to.equal('hello world\n');
      });

      test('should include jsx when `allow-js` true', async () => {
        const { err, stdout } = await exec(
          [
            cmd,
            '-O "{\\"allowJs\\":true}"',
            '-pe "import { Foo2 } from \'./allow-js/with-jsx\'; Foo2.sayHi()"',
          ].join(' ')
        );
        expect(err).to.equal(null);
        expect(stdout).to.equal('hello world\n');
      });
    }

    test('should eval code', async () => {
      const { err, stdout } = await exec(
        `${cmd} -e "import * as m from './module';console.log(m.example('test'))"`
      );
      expect(err).to.equal(null);
      expect(stdout).to.equal('TEST\n');
    });

    test('should import empty files', async () => {
      const { err, stdout } = await exec(`${cmd} -e "import './empty'"`);
      expect(err).to.equal(null);
      expect(stdout).to.equal('');
    });

    test('should throw errors', async () => {
      const { err } = await exec(
        `${cmd} -e "import * as m from './module';console.log(m.example(123))"`
      );
      if (err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(err.message).to.match(
        new RegExp(
          "TS2345: Argument of type '(?:number|123)' " +
            "is not assignable to parameter of type 'string'\\."
        )
      );
    });

    test('should be able to ignore diagnostic', async () => {
      const { err } = await exec(
        `${cmd} --ignore-diagnostics 2345 -e "import * as m from './module';console.log(m.example(123))"`
      );
      if (err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(err.message).to.match(
        /TypeError: (?:(?:undefined|foo\.toUpperCase) is not a function|.*has no method \'toUpperCase\')/
      );
    });

    test('should work with source maps', async () => {
      const { err } = await exec(`${cmd} "throw error"`);
      if (err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(err.message).to.contain(
        [
          `${join(TEST_DIR, 'throw error.ts')}:100`,
          "  bar() { throw new Error('this is a demo'); }",
          '                ^',
          'Error: this is a demo',
        ].join('\n')
      );
    });

    test('should work with source maps in --transpile-only mode', async () => {
      const { err } = await exec(`${cmd} --transpile-only "throw error"`);
      if (err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(err.message).to.contain(
        [
          `${join(TEST_DIR, 'throw error.ts')}:100`,
          "  bar() { throw new Error('this is a demo'); }",
          '                ^',
          'Error: this is a demo',
        ].join('\n')
      );
    });

    test('eval should work with source maps', async () => {
      const { err } = await exec(`${cmd} -pe "import './throw error'"`);
      if (err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(err.message).to.contain(
        [
          `${join(TEST_DIR, 'throw error.ts')}:100`,
          "  bar() { throw new Error('this is a demo'); }",
          '                ^',
        ].join('\n')
      );
    });

    test('should support transpile only mode', async () => {
      const { err } = await exec(`${cmd} --transpile-only -pe "x"`);
      if (err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(err.message).to.contain('ReferenceError: x is not defined');
    });

    test('should throw error even in transpileOnly mode', async () => {
      const { err } = await exec(`${cmd} --transpile-only -pe "console."`);
      if (err === null) {
        throw new Error('Command was expected to fail, but it succeeded.');
      }

      expect(err.message).to.contain('error TS1003: Identifier expected');
    });

    test('should support third-party transpilers via --transpiler', async () => {
      const { err, stdout } = await exec(
        `${cmdNoProject} --transpiler ts-node/transpilers/swc-experimental transpile-only-swc`
      );
      expect(err).to.equal(null);
      expect(stdout).to.contain('Hello World!');
    });

    test('should support third-party transpilers via tsconfig', async () => {
      const { err, stdout } = await exec(
        `${cmdNoProject} transpile-only-swc-via-tsconfig`
      );
      expect(err).to.equal(null);
      expect(stdout).to.contain('Hello World!');
    });

    test('should pipe into `ts-node` and evaluate', async () => {
      const execPromise = exec(cmd);
      execPromise.child.stdin!.end("console.log('hello')");
      const { err, stdout } = await execPromise;
      expect(err).to.equal(null);
      expect(stdout).to.equal('hello\n');
    });

    test('should pipe into `ts-node`', async () => {
      const execPromise = exec(`${cmd} -p`);
      execPromise.child.stdin!.end('true');
      const { err, stdout } = await execPromise;
      expect(err).to.equal(null);
      expect(stdout).to.equal('true\n');
    });

    test('should pipe into an eval script', async () => {
      const execPromise = exec(
        `${cmd} --transpile-only -pe "process.stdin.isTTY"`
      );
      execPromise.child.stdin!.end('true');
      const { err, stdout } = await execPromise;
      expect(err).to.equal(null);
      expect(stdout).to.equal('undefined\n');
    });

    test('should run REPL when --interactive passed and stdin is not a TTY', async () => {
      const execPromise = exec(`${cmd} --interactive`);
      execPromise.child.stdin!.end('console.log("123")\n');
      const { err, stdout } = await execPromise;
      expect(err).to.equal(null);
      expect(stdout).to.equal('> 123\n' + 'undefined\n' + '> ');
    });

    test('REPL has command to get type information', async () => {
      const execPromise = exec(`${cmd} --interactive`);
      execPromise.child.stdin!.end('\nconst a = 123\n.type a');
      const { err, stdout } = await execPromise;
      expect(err).to.equal(null);
      expect(stdout).to.equal(
        "> 'use strict'\n" + '> undefined\n' + '> const a: 123\n' + '> '
      );
    });

    function createReplViaApi() {
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const replService = createRepl({
        stdin,
        stdout,
        stderr,
      });
      const service = create({
        ...replService.evalAwarePartialHost,
        project: `${TEST_DIR}/tsconfig.json`,
      });
      replService.setService(service);
      return { stdin, stdout, stderr, replService, service };
    }

    // Serial because it's timing-sensitive
    test.serial('REPL can be created via API', async () => {
      const { stdin, stdout, stderr, replService } = createReplViaApi();
      replService.start();
      stdin.write('\nconst a = 123\n.type a\n');
      stdin.end();
      await promisify(setTimeout)(1e3);
      stdout.end();
      stderr.end();
      expect(await getStream(stderr)).to.equal('');
      expect(await getStream(stdout)).to.equal(
        "> 'use strict'\n" + '> undefined\n' + '> const a: 123\n' + '> '
      );
    });

    test.suite(
      '[eval], <repl>, and [stdin] execute with correct globals',
      (test) => {
        const cliTest = test.macro(
          (
            {
              flags,
              stdin,
            }: {
              flags: string;
              stdin: string;
            },
            assertions: (stdout: string) => void
          ) => async (t) => {
            const execPromise = exec(`${cmd} ${flags}`);
            // Uncomment to run against vanilla node, useful to verify that these test cases match vanilla node
            // const execPromise = exec(`node ${flags}`);
            execPromise.child.stdin!.end(stdin);
            const { err, stdout } = await execPromise;
            expect(err).to.equal(null);
            await assertions(stdout);
          }
        );
        const programmaticTest = test.macro(
          (
            evalCodeBefore: string | null,
            stdinCode: string,
            assertions: (stdout: string) => void
          ) => async (t) => {
            (global as any).testReport = undefined;
            (global as any).replReport = undefined;
            (global as any).stdinReport = undefined;
            (global as any).evalReport = undefined;
            const { stdin, stderr, stdout, replService } = createReplViaApi();
            if (typeof evalCodeBefore === 'string') {
              replService.evalCode(evalCodeBefore);
            }
            replService.start();
            stdin.write(stdinCode);
            stdin.end();
            await promisify(setTimeout)(1e3);
            stdout.end();
            stderr.end();
            expect(await getStream(stderr)).to.equal('');
            await assertions(await getStream(stdout));
          }
        );

        const declareGlobals = `declare var replReport: any, stdinReport: any, evalReport: any, restReport: any, global: any, __filename: any, __dirname: any, module: any, exports: any, fs: any;`;
        function setReportGlobal(type: 'repl' | 'stdin' | 'eval') {
          return `
            ${declareGlobals}
            global.${type}Report = {
              __filename: typeof __filename !== 'undefined' && __filename,
              __dirname: typeof __dirname !== 'undefined' && __dirname,
              moduleId: module.id,
              modulePath: module.path,
              moduleFilename: module.filename,
              modulePaths: module.paths,
              exportsTest: typeof exports !== 'undefined' ? module.exports === exports : null,
              stackTest: new Error().stack!.split('\\n')[1],
              moduleAccessorsTest: typeof fs === 'undefined' ? null : fs === require('fs'),
              argv: process.argv
            };
          `.replace(/\n/g, '');
        }
        const reportsObject = `
          {
            stdinReport: typeof stdinReport !== 'undefined' && stdinReport,
            evalReport: typeof evalReport !== 'undefined' && evalReport,
            replReport: typeof replReport !== 'undefined' && replReport
          }
        `;
        const printReports = `
          ${declareGlobals}
          console.log(JSON.stringify(${reportsObject}));
        `.replace(/\n/g, '');
        const saveReportsAsGlobal = `
          ${declareGlobals}
          global.testReport = ${reportsObject};
        `.replace(/\n/g, '');

        function parseStdoutStripReplPrompt(stdout: string) {
          // Strip node's welcome header; TODO Remove this
          stdout = stdout.replace(/^Welcome to.*\nType "\.help" .*\n/, '');
          expect(stdout.slice(0, 2)).to.equal('> ');
          expect(stdout.slice(-12)).to.equal('undefined\n> ');
          return parseStdout(stdout.slice(2, -12));
        }
        function parseStdout(stdout: string) {
          return JSON.parse(stdout);
        }

        /** Every possible ./node_modules directory ascending upwards starting with ./tests/node_modules */
        const modulePaths: string[] = [];
        for (let path = TEST_DIR; ; path = dirname(path)) {
          modulePaths.push(join(path, 'node_modules'));
          if (dirname(path) === path) break;
        }

        test(
          'stdin',
          cliTest,
          {
            stdin: `${setReportGlobal('stdin')};${printReports}`,
            flags: '',
          },
          (stdout) => {
            const report = parseStdout(stdout);
            exp(report).toMatchObject({
              stdinReport: {
                __filename: '[stdin]',
                __dirname: '.',
                moduleId: '[stdin]',
                modulePath: '.',
                // Note: vanilla node does does not have file extension
                moduleFilename: join(TEST_DIR, `[stdin].ts`),
                modulePaths,
                exportsTest: true,
                // Note: vanilla node uses different name. See #1360
                stackTest: `    at ${join(TEST_DIR, `[stdin].ts`)}:1:429`,
                moduleAccessorsTest: null,
                argv: [exp.stringMatching(/\bnode$/)],
              },
              evalReport: false,
              replReport: false,
            });
          }
        );
        test(
          'repl',
          cliTest,
          {
            stdin: `${setReportGlobal('repl')};${printReports}`,
            flags: '-i',
          },
          (stdout) => {
            const report = parseStdoutStripReplPrompt(stdout);
            exp(report).toMatchObject({
              stdinReport: false,
              evalReport: false,
              replReport: {
                __filename: false,
                __dirname: false,
                moduleId: '<repl>',
                modulePath: '.',
                moduleFilename: null,
                modulePaths: [
                  join(TEST_DIR, `repl/node_modules`),
                  ...modulePaths,
                  join(homedir(), `.node_modules`),
                  join(homedir(), `.node_libraries`),
                  // additional entry goes to node's install path
                  exp.any(String),
                ],
                // Note: vanilla node REPL does not set exports
                exportsTest: true,
                // Note: vanilla node uses different name. See #1360
                stackTest: `    at ${join(TEST_DIR, '<repl>.ts')}:1:428`,
                moduleAccessorsTest: true,
                argv: [exp.stringMatching(/\bnode$/)],
              },
            });
          }
        );

        // Should ignore -i and run the entrypoint
        test(
          '-i w/entrypoint ignores -i',
          cliTest,
          {
            stdin: `${setReportGlobal('repl')};${printReports}`,
            flags: '-i ./repl/script.js',
          },
          (stdout) => {
            const report = parseStdout(stdout);
            exp(report).toMatchObject({
              stdinReport: false,
              evalReport: false,
              replReport: false,
            });
          }
        );

        // Should not execute stdin
        // Should not interpret positional arg as an entrypoint script
        test(
          '-e',
          cliTest,
          {
            stdin: `throw new Error()`,
            flags: `-e "${setReportGlobal('eval')};${printReports}"`,
          },
          (stdout) => {
            const report = parseStdout(stdout);
            exp(report).toMatchObject({
              stdinReport: false,
              evalReport: {
                __filename: '[eval]',
                __dirname: '.',
                moduleId: '[eval]',
                modulePath: '.',
                // Note: vanilla node does does not have file extension
                moduleFilename: join(TEST_DIR, `[eval].ts`),
                modulePaths: [
                  ...modulePaths,
                ],
                exportsTest: true,
                // Note: vanilla node uses different name. See #1360
                stackTest: `    at ${join(TEST_DIR, `[eval].ts`)}:1:428`,
                moduleAccessorsTest: true,
                argv: [exp.stringMatching(/\bnode$/)],
              },
              replReport: false,
            });
          }
        );
        test(
          '-e w/entrypoint arg does not execute entrypoint',
          cliTest,
          {
            stdin: `throw new Error()`,
            flags: `-e "${setReportGlobal(
              'eval'
            )};${printReports}" ./repl/script.js`,
          },
          (stdout) => {
            const report = parseStdout(stdout);
            exp(report).toMatchObject({
              stdinReport: false,
              evalReport: {
                __filename: '[eval]',
                __dirname: '.',
                moduleId: '[eval]',
                modulePath: '.',
                // Note: vanilla node does does not have file extension
                moduleFilename: join(TEST_DIR, `[eval].ts`),
                modulePaths: [
                  ...modulePaths,
                ],
                exportsTest: true,
                // Note: vanilla node uses different name. See #1360
                stackTest: `    at ${join(TEST_DIR, `[eval].ts`)}:1:428`,
                moduleAccessorsTest: true,
                argv: [exp.stringMatching(/\bnode$/), './repl/script.js'],
              },
              replReport: false,
            });
          }
        );
        test(
          '-e w/non-path arg',
          cliTest,
          {
            stdin: `throw new Error()`,
            flags: `-e "${setReportGlobal(
              'eval'
            )};${printReports}" ./does-not-exist.js`,
          },
          (stdout) => {
            const report = parseStdout(stdout);
            exp(report).toMatchObject({
              stdinReport: false,
              evalReport: {
                __filename: '[eval]',
                __dirname: '.',
                moduleId: '[eval]',
                modulePath: '.',
                // Note: vanilla node does does not have file extension
                moduleFilename: join(TEST_DIR, `[eval].ts`),
                modulePaths: [
                  ...modulePaths,
                ],
                exportsTest: true,
                // Note: vanilla node uses different name. See #1360
                stackTest: `    at ${join(TEST_DIR, `[eval].ts`)}:1:428`,
                moduleAccessorsTest: true,
                argv: [exp.stringMatching(/\bnode$/), './does-not-exist.js'],
              },
              replReport: false,
            });
          }
        );
        test(
          '-e -i',
          cliTest,
          {
            stdin: `${setReportGlobal('repl')};${printReports}`,
            flags: `-e "${setReportGlobal('eval')}" -i`,
          },
          (stdout) => {
            const report = parseStdoutStripReplPrompt(stdout);
            exp(report).toMatchObject({
              stdinReport: false,
              evalReport: {
                __filename: '[eval]',
                __dirname: '.',
                moduleId: '[eval]',
                modulePath: '.',
                // Note: vanilla node does does not have file extension
                moduleFilename: join(TEST_DIR, `[eval].ts`),
                modulePaths: [
                  ...modulePaths,
                ],
                exportsTest: true,
                // Note: vanilla node uses different name. See #1360
                stackTest: `    at ${join(TEST_DIR, `[eval].ts`)}:1:428`,
                moduleAccessorsTest: true,
                argv: [exp.stringMatching(/\bnode$/)],
              },
              replReport: {
                __filename: '[eval]',
                __dirname: '.',
                moduleId: '<repl>',
                modulePath: '.',
                moduleFilename: null,
                modulePaths: [
                  join(TEST_DIR, `repl/node_modules`),
                  ...modulePaths,
                  join(homedir(), `.node_modules`),
                  join(homedir(), `.node_libraries`),
                  // additional entry goes to node's install path
                  exp.any(String),
                ],
                // Note: vanilla node REPL does not set exports, so this would be false
                exportsTest: true,
                // Note: vanilla node uses different name. See #1360
                stackTest: `    at ${join(TEST_DIR, '<repl>.ts>')}:1:428`,
                moduleAccessorsTest: true,
                argv: [exp.stringMatching(/\bnode$/)],
              },
            });
          }
        );

        test(
          '-e -i w/entrypoint ignores -e and -i, runs entrypoint',
          cliTest,
          {
            stdin: `throw new Error()`,
            flags: '-e "throw new Error()" -i ./repl/script.js',
          },
          (stdout) => {
            const report = parseStdout(stdout);
            exp(report).toMatchObject({
              stdinReport: false,
              evalReport: false,
              replReport: false,
            });
          }
        );

        // TODO add test case when -e throws error; REPL should not run

        // Serial because it's timing-sensitive
        test.serial(
          'programmatically, eval-ing before starting REPL',
          programmaticTest,
          `${setReportGlobal('eval')};${saveReportsAsGlobal}`,
          '',
          (stdout) => {}
        );
        test.serial(
          'programmatically, passing code to stdin after starting REPL',
          programmaticTest,
          null,
          `${setReportGlobal('repl')};${saveReportsAsGlobal}`,
          (stdout) => {}
        );
      }
    );

    test('should support require flags', async () => {
      const { err, stdout } = await exec(
        `${cmd} -r ./hello-world -pe "console.log('success')"`
      );
      expect(err).to.equal(null);
      expect(stdout).to.equal('Hello, world!\nsuccess\nundefined\n');
    });

    test('should support require from node modules', async () => {
      const { err, stdout } = await exec(
        `${cmd} -r typescript -e "console.log('success')"`
      );
      expect(err).to.equal(null);
      expect(stdout).to.equal('success\n');
    });

    test('should use source maps with react tsx', async () => {
      const { err, stdout } = await exec(`${cmd} "throw error react tsx.tsx"`);
      expect(err).not.to.equal(null);
      expect(err!.message).to.contain(
        [
          `${join(TEST_DIR, './throw error react tsx.tsx')}:100`,
          "  bar() { throw new Error('this is a demo'); }",
          '                ^',
          'Error: this is a demo',
        ].join('\n')
      );
    });

    test('should use source maps with react tsx in --transpile-only mode', async () => {
      const { err, stdout } = await exec(
        `${cmd} --transpile-only "throw error react tsx.tsx"`
      );
      expect(err).not.to.equal(null);
      expect(err!.message).to.contain(
        [
          `${join(TEST_DIR, './throw error react tsx.tsx')}:100`,
          "  bar() { throw new Error('this is a demo'); }",
          '                ^',
          'Error: this is a demo',
        ].join('\n')
      );
    });

    test('should allow custom typings', async () => {
      const { err, stdout } = await exec(`${cmd} custom-types`);
      expect(err).to.match(/Error: Cannot find module 'does-not-exist'/);
    });

    test('should preserve `ts-node` context with child process', async () => {
      const { err, stdout } = await exec(`${cmd} child-process`);
      expect(err).to.equal(null);
      expect(stdout).to.equal('Hello, world!\n');
    });

    test('should import js before ts by default', async () => {
      const { err, stdout } = await exec(`${cmd} import-order/compiled`);
      expect(err).to.equal(null);
      expect(stdout).to.equal('Hello, JavaScript!\n');
    });

    const preferTsExtsEntrypoint = semver.gte(process.version, '12.0.0')
      ? 'import-order/compiled'
      : 'import-order/require-compiled';
    test('should import ts before js when --prefer-ts-exts flag is present', async () => {
      const { err, stdout } = await exec(
        `${cmd} --prefer-ts-exts ${preferTsExtsEntrypoint}`
      );
      expect(err).to.equal(null);
      expect(stdout).to.equal('Hello, TypeScript!\n');
    });

    test('should import ts before js when TS_NODE_PREFER_TS_EXTS env is present', async () => {
      const { err, stdout } = await exec(`${cmd} ${preferTsExtsEntrypoint}`, {
        env: { ...process.env, TS_NODE_PREFER_TS_EXTS: 'true' },
      });
      expect(err).to.equal(null);
      expect(stdout).to.equal('Hello, TypeScript!\n');
    });

    test('should ignore .d.ts files', async () => {
      const { err, stdout } = await exec(`${cmd} import-order/importer`);
      expect(err).to.equal(null);
      expect(stdout).to.equal('Hello, World!\n');
    });

    test.suite('issue #884', (test) => {
      test('should compile', async (t) => {
        // TODO disabled because it consistently fails on Windows on TS 2.7
        if (
          process.platform === 'win32' &&
          semver.satisfies(ts.version, '2.7')
        ) {
          t.log('Skipping');
          return;
        } else {
          const { err, stdout } = await exec(
            `"${BIN_PATH}" --project issue-884/tsconfig.json issue-884`
          );
          expect(err).to.equal(null);
          expect(stdout).to.equal('');
        }
      });
    });

    test.suite('issue #986', (test) => {
      test('should not compile', async () => {
        const { err, stdout, stderr } = await exec(
          `"${BIN_PATH}" --project issue-986/tsconfig.json issue-986`
        );
        expect(err).not.to.equal(null);
        expect(stderr).to.contain("Cannot find name 'TEST'"); // TypeScript error.
        expect(stdout).to.equal('');
      });

      test('should compile with `--files`', async () => {
        const { err, stdout, stderr } = await exec(
          `"${BIN_PATH}" --files --project issue-986/tsconfig.json issue-986`
        );
        expect(err).not.to.equal(null);
        expect(stderr).to.contain('ReferenceError: TEST is not defined'); // Runtime error.
        expect(stdout).to.equal('');
      });
    });

    if (semver.gte(ts.version, '2.7.0')) {
      test('should locate tsconfig relative to entry-point by default', async () => {
        const { err, stdout } = await exec(`${BIN_PATH} ../a/index`, {
          cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
        });
        expect(err).to.equal(null);
        expect(stdout).to.match(/plugin-a/);
      });
      test('should locate tsconfig relative to entry-point via ts-node-script', async () => {
        const { err, stdout } = await exec(`${BIN_SCRIPT_PATH} ../a/index`, {
          cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
        });
        expect(err).to.equal(null);
        expect(stdout).to.match(/plugin-a/);
      });
      test('should locate tsconfig relative to entry-point with --script-mode', async () => {
        const { err, stdout } = await exec(
          `${BIN_PATH} --script-mode ../a/index`,
          {
            cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
          }
        );
        expect(err).to.equal(null);
        expect(stdout).to.match(/plugin-a/);
      });
      test('should locate tsconfig relative to cwd via ts-node-cwd', async () => {
        const { err, stdout } = await exec(`${BIN_CWD_PATH} ../a/index`, {
          cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
        });
        expect(err).to.equal(null);
        expect(stdout).to.match(/plugin-b/);
      });
      test('should locate tsconfig relative to cwd in --cwd-mode', async () => {
        const { err, stdout } = await exec(
          `${BIN_PATH} --cwd-mode ../a/index`,
          { cwd: join(TEST_DIR, 'cwd-and-script-mode/b') }
        );
        expect(err).to.equal(null);
        expect(stdout).to.match(/plugin-b/);
      });
      test('should locate tsconfig relative to realpath, not symlink, when entrypoint is a symlink', async (t) => {
        if (
          lstatSync(
            join(TEST_DIR, 'main-realpath/symlink/symlink.tsx')
          ).isSymbolicLink()
        ) {
          const { err, stdout } = await exec(
            `${BIN_PATH} main-realpath/symlink/symlink.tsx`
          );
          expect(err).to.equal(null);
          expect(stdout).to.equal('');
        } else {
          t.log('Skipping');
          return;
        }
      });
    }

    test.suite('should read ts-node options from tsconfig.json', (test) => {
      const BIN_EXEC = `"${BIN_PATH}" --project tsconfig-options/tsconfig.json`;

      test('should override compiler options from env', async () => {
        const { err, stdout } = await exec(
          `${BIN_EXEC} tsconfig-options/log-options1.js`,
          {
            env: {
              ...process.env,
              TS_NODE_COMPILER_OPTIONS: '{"typeRoots": ["env-typeroots"]}',
            },
          }
        );
        expect(err).to.equal(null);
        const { config } = JSON.parse(stdout);
        expect(config.options.typeRoots).to.deep.equal([
          join(TEST_DIR, './tsconfig-options/env-typeroots').replace(
            /\\/g,
            '/'
          ),
        ]);
      });

      test('should use options from `tsconfig.json`', async () => {
        const { err, stdout } = await exec(
          `${BIN_EXEC} tsconfig-options/log-options1.js`
        );
        expect(err).to.equal(null);
        const { options, config } = JSON.parse(stdout);
        expect(config.options.typeRoots).to.deep.equal([
          join(TEST_DIR, './tsconfig-options/tsconfig-typeroots').replace(
            /\\/g,
            '/'
          ),
        ]);
        expect(config.options.types).to.deep.equal(['tsconfig-tsnode-types']);
        expect(options.pretty).to.equal(undefined);
        expect(options.skipIgnore).to.equal(false);
        expect(options.transpileOnly).to.equal(true);
        expect(options.require).to.deep.equal([
          join(TEST_DIR, './tsconfig-options/required1.js'),
        ]);
      });

      test('should have flags override / merge with `tsconfig.json`', async () => {
        const { err, stdout } = await exec(
          `${BIN_EXEC} --skip-ignore --compiler-options "{\\"types\\":[\\"flags-types\\"]}" --require ./tsconfig-options/required2.js tsconfig-options/log-options2.js`
        );
        expect(err).to.equal(null);
        const { options, config } = JSON.parse(stdout);
        expect(config.options.typeRoots).to.deep.equal([
          join(TEST_DIR, './tsconfig-options/tsconfig-typeroots').replace(
            /\\/g,
            '/'
          ),
        ]);
        expect(config.options.types).to.deep.equal(['flags-types']);
        expect(options.pretty).to.equal(undefined);
        expect(options.skipIgnore).to.equal(true);
        expect(options.transpileOnly).to.equal(true);
        expect(options.require).to.deep.equal([
          join(TEST_DIR, './tsconfig-options/required1.js'),
          './tsconfig-options/required2.js',
        ]);
      });

      test('should have `tsconfig.json` override environment', async () => {
        const { err, stdout } = await exec(
          `${BIN_EXEC} tsconfig-options/log-options1.js`,
          {
            env: {
              ...process.env,
              TS_NODE_PRETTY: 'true',
              TS_NODE_SKIP_IGNORE: 'true',
            },
          }
        );
        expect(err).to.equal(null);
        const { options, config } = JSON.parse(stdout);
        expect(config.options.typeRoots).to.deep.equal([
          join(TEST_DIR, './tsconfig-options/tsconfig-typeroots').replace(
            /\\/g,
            '/'
          ),
        ]);
        expect(config.options.types).to.deep.equal(['tsconfig-tsnode-types']);
        expect(options.pretty).to.equal(true);
        expect(options.skipIgnore).to.equal(false);
        expect(options.transpileOnly).to.equal(true);
        expect(options.require).to.deep.equal([
          join(TEST_DIR, './tsconfig-options/required1.js'),
        ]);
      });
    });

    test.suite(
      'should use implicit @tsconfig/bases config when one is not loaded from disk',
      (_test) => {
        const test = _test.context(async (t) => ({
          tempDir: mkdtempSync(join(tmpdir(), 'ts-node-spec')),
        }));
        if (
          semver.gte(ts.version, '3.5.0') &&
          semver.gte(process.versions.node, '14.0.0')
        ) {
          test('implicitly uses @tsconfig/node14 or @tsconfig/node16 compilerOptions when both TS and node versions support it', async (t) => {
            // node14 and node16 configs are identical, hence the "or"
            const {
              context: { tempDir },
            } = t;
            const {
              err: err1,
              stdout: stdout1,
              stderr: stderr1,
            } = await exec(`${BIN_PATH} --showConfig`, { cwd: tempDir });
            expect(err1).to.equal(null);
            t.like(JSON.parse(stdout1), {
              compilerOptions: {
                target: 'es2020',
                lib: ['es2020'],
              },
            });
            const {
              err: err2,
              stdout: stdout2,
              stderr: stderr2,
            } = await exec(`${BIN_PATH} -pe 10n`, { cwd: tempDir });
            expect(err2).to.equal(null);
            expect(stdout2).to.equal('10n\n');
          });
        } else {
          test('implicitly uses @tsconfig/* lower than node14 (node12) when either TS or node versions do not support @tsconfig/node14', async ({
            context: { tempDir },
          }) => {
            const { err, stdout, stderr } = await exec(`${BIN_PATH} -pe 10n`, {
              cwd: tempDir,
            });
            expect(err).to.not.equal(null);
            expect(stderr).to.match(
              /BigInt literals are not available when targeting lower than|error TS2304: Cannot find name 'n'/
            );
          });
        }
        test('implicitly loads @types/node even when not installed within local directory', async ({
          context: { tempDir },
        }) => {
          const { err, stdout, stderr } = await exec(
            `${BIN_PATH} -pe process.env.foo`,
            {
              cwd: tempDir,
              env: { ...process.env, foo: 'hello world' },
            }
          );
          expect(err).to.equal(null);
          expect(stdout).to.equal('hello world\n');
        });
        test('implicitly loads local @types/node', async ({
          context: { tempDir },
        }) => {
          await xfs.copyPromise(
            npath.toPortablePath(tempDir),
            npath.toPortablePath(join(TEST_DIR, 'local-types-node'))
          );
          const { err, stdout, stderr } = await exec(
            `${BIN_PATH} -pe process.env.foo`,
            {
              cwd: tempDir,
              env: { ...process.env, foo: 'hello world' },
            }
          );
          expect(err).to.not.equal(null);
          expect(stderr).to.contain(
            "Property 'env' does not exist on type 'LocalNodeTypes_Process'"
          );
        });
      }
    );

    if (semver.gte(ts.version, '3.2.0')) {
      test.suite(
        'should bundle @tsconfig/bases to be used in your own tsconfigs',
        (test) => {
          const macro = test.macro((nodeVersion: string) => async (t) => {
            const config = require(`@tsconfig/${nodeVersion}/tsconfig.json`);
            const { err, stdout, stderr } = await exec(
              `${BIN_PATH} --showConfig -e 10n`,
              {
                cwd: join(TEST_DIR, 'tsconfig-bases', nodeVersion),
              }
            );
            expect(err).to.equal(null);
            t.like(JSON.parse(stdout), {
              compilerOptions: {
                target: config.compilerOptions.target,
                lib: config.compilerOptions.lib,
              },
            });
          });
          test(`ts-node/node10/tsconfig.json`, macro, 'node10');
          test(`ts-node/node12/tsconfig.json`, macro, 'node12');
          test(`ts-node/node14/tsconfig.json`, macro, 'node14');
          test(`ts-node/node16/tsconfig.json`, macro, 'node16');
        }
      );
    }

    test.suite('compiler host', (test) => {
      test('should execute cli', async () => {
        const { err, stdout } = await exec(
          `${cmd} --compiler-host hello-world`
        );
        expect(err).to.equal(null);
        expect(stdout).to.equal('Hello, world!\n');
      });
    });

    test('should transpile files inside a node_modules directory when not ignored', async () => {
      const { err, stdout, stderr } = await exec(
        `${cmdNoProject} from-node-modules/from-node-modules`
      );
      if (err)
        throw new Error(
          `Unexpected error: ${err}\nstdout:\n${stdout}\nstderr:\n${stderr}`
        );
      expect(JSON.parse(stdout)).to.deep.equal({
        external: {
          tsmri: { name: 'typescript-module-required-internally' },
          jsmri: { name: 'javascript-module-required-internally' },
          tsmii: { name: 'typescript-module-imported-internally' },
          jsmii: { name: 'javascript-module-imported-internally' },
        },
        tsmie: { name: 'typescript-module-imported-externally' },
        jsmie: { name: 'javascript-module-imported-externally' },
        tsmre: { name: 'typescript-module-required-externally' },
        jsmre: { name: 'javascript-module-required-externally' },
      });
    });

    test.suite('should respect maxNodeModulesJsDepth', (test) => {
      test('for unscoped modules', async () => {
        const { err, stdout, stderr } = await exec(
          `${cmdNoProject} maxnodemodulesjsdepth`
        );
        expect(err).to.not.equal(null);
        expect(stderr.replace(/\r\n/g, '\n')).to.contain(
          'TSError: ⨯ Unable to compile TypeScript:\n' +
            "maxnodemodulesjsdepth/other.ts(4,7): error TS2322: Type 'string' is not assignable to type 'boolean'.\n" +
            '\n'
        );
      });

      test('for @scoped modules', async () => {
        const { err, stdout, stderr } = await exec(
          `${cmdNoProject} maxnodemodulesjsdepth-scoped`
        );
        expect(err).to.not.equal(null);
        expect(stderr.replace(/\r\n/g, '\n')).to.contain(
          'TSError: ⨯ Unable to compile TypeScript:\n' +
            "maxnodemodulesjsdepth-scoped/other.ts(7,7): error TS2322: Type 'string' is not assignable to type 'boolean'.\n" +
            '\n'
        );
      });
    });

    if (semver.gte(ts.version, '3.2.0')) {
      test('--show-config should log resolved configuration', async (t) => {
        function native(path: string) {
          return path.replace(/\/|\\/g, pathSep);
        }
        function posix(path: string) {
          return path.replace(/\/|\\/g, '/');
        }
        const { err, stdout } = await exec(`${cmd} --showConfig`);
        expect(err).to.equal(null);
        t.is(
          stdout,
          JSON.stringify(
            {
              'ts-node': {
                cwd: native(`${ROOT_DIR}/tests`),
                projectSearchDir: native(`${ROOT_DIR}/tests`),
                project: native(`${ROOT_DIR}/tests/tsconfig.json`),
                require: [],
              },
              compilerOptions: {
                target: 'es6',
                jsx: 'react',
                noEmit: false,
                strict: true,
                typeRoots: [
                  posix(`${ROOT_DIR}/tests/typings`),
                  posix(`${ROOT_DIR}/node_modules/@types`),
                ],
                sourceMap: true,
                inlineSourceMap: false,
                inlineSources: true,
                declaration: false,
                outDir: './.ts-node',
                module: 'commonjs',
              },
            },
            null,
            2
          ) + '\n'
        );
      });
    } else {
      test('--show-config should log error message when used with old typescript versions', async (t) => {
        const { err, stderr } = await exec(`${cmd} --showConfig`);
        expect(err).to.not.equal(null);
        expect(stderr).to.contain('Error: --show-config requires');
      });
    }

    test('should support compiler scope specified via tsconfig.json', async (t) => {
      const { err, stderr, stdout } = await exec(
        `${cmd} --project ./scope/c/config/tsconfig.json ./scope/c/index.js`
      );
      expect(err).to.equal(null);
      expect(stdout).to.equal(`value\nFailures: 0\n`);
    });
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
      } catch (error) {
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
        } catch (error) {
          expect(error.stack).to.contain('SyntaxError: Unexpected token');
        }

        expect(compiled).to.match(SOURCE_MAP_REGEXP);
      });
    });
  });

  test.suite('create', (_test) => {
    const test = _test.context(async (t) => {
      return {
        service: create({
          compilerOptions: { target: 'es5' },
          skipProject: true,
        }),
      };
    });

    test('should create generic compiler instances', ({
      context: { service },
    }) => {
      const output = service.compile('const x = 10', 'test.ts');
      expect(output).to.contain('var x = 10;');
    });

    test.suite('should get type information', (test) => {
      test('given position of identifier', ({ context: { service } }) => {
        expect(
          service.getTypeInfo('/**jsdoc here*/const x = 10', 'test.ts', 21)
        ).to.deep.equal({
          comment: 'jsdoc here',
          name: 'const x: 10',
        });
      });
      test('given position that does not point to an identifier', ({
        context: { service },
      }) => {
        expect(
          service.getTypeInfo('/**jsdoc here*/const x = 10', 'test.ts', 0)
        ).to.deep.equal({
          comment: '',
          name: '',
        });
      });
    });
  });

  test.suite('issue #1098', (test) => {
    function testIgnored(
      ignored: tsNodeTypes.Service['ignored'],
      allowed: string[],
      disallowed: string[]
    ) {
      for (const ext of allowed) {
        expect(ignored(join(DIST_DIR, `index${ext}`))).equal(
          false,
          `should accept ${ext} files`
        );
      }
      for (const ext of disallowed) {
        expect(ignored(join(DIST_DIR, `index${ext}`))).equal(
          true,
          `should ignore ${ext} files`
        );
      }
    }

    test('correctly filters file extensions from the compiler when allowJs=false and jsx=false', () => {
      const { ignored } = create({ compilerOptions: {}, skipProject: true });
      testIgnored(
        ignored,
        ['.ts', '.d.ts'],
        ['.js', '.tsx', '.jsx', '.mjs', '.cjs', '.xyz', '']
      );
    });
    test('correctly filters file extensions from the compiler when allowJs=true and jsx=false', () => {
      const { ignored } = create({
        compilerOptions: { allowJs: true },
        skipProject: true,
      });
      testIgnored(
        ignored,
        ['.ts', '.js', '.d.ts'],
        ['.tsx', '.jsx', '.mjs', '.cjs', '.xyz', '']
      );
    });
    test('correctly filters file extensions from the compiler when allowJs=false and jsx=true', () => {
      const { ignored } = create({
        compilerOptions: { allowJs: false, jsx: 'preserve' },
        skipProject: true,
      });
      testIgnored(
        ignored,
        ['.ts', '.tsx', '.d.ts'],
        ['.js', '.jsx', '.mjs', '.cjs', '.xyz', '']
      );
    });
    test('correctly filters file extensions from the compiler when allowJs=true and jsx=true', () => {
      const { ignored } = create({
        compilerOptions: { allowJs: true, jsx: 'preserve' },
        skipProject: true,
      });
      testIgnored(
        ignored,
        ['.ts', '.tsx', '.js', '.jsx', '.d.ts'],
        ['.mjs', '.cjs', '.xyz', '']
      );
    });
  });

  test.suite('esm', (test) => {
    const experimentalModulesFlag = semver.gte(process.version, '12.17.0')
      ? ''
      : '--experimental-modules';
    const cmd = `node ${experimentalModulesFlag} --loader ts-node/esm`;

    if (semver.gte(process.version, '12.16.0')) {
      test('should compile and execute as ESM', async () => {
        const { err, stdout } = await exec(`${cmd} index.ts`, {
          cwd: join(TEST_DIR, './esm'),
        });
        expect(err).to.equal(null);
        expect(stdout).to.equal('foo bar baz biff libfoo\n');
      });
      test('should use source maps', async () => {
        const { err, stdout } = await exec(`${cmd} "throw error.ts"`, {
          cwd: join(TEST_DIR, './esm'),
        });
        expect(err).not.to.equal(null);
        expect(err!.message).to.contain(
          [
            `${pathToFileURL(join(TEST_DIR, './esm/throw error.ts'))
              .toString()
              .replace(/%20/g, ' ')}:100`,
            "  bar() { throw new Error('this is a demo'); }",
            '                ^',
            'Error: this is a demo',
          ].join('\n')
        );
      });

      test.suite('supports experimental-specifier-resolution=node', (test) => {
        test('via --experimental-specifier-resolution', async () => {
          const {
            err,
            stdout,
          } = await exec(
            `${cmd} --experimental-specifier-resolution=node index.ts`,
            { cwd: join(TEST_DIR, './esm-node-resolver') }
          );
          expect(err).to.equal(null);
          expect(stdout).to.equal('foo bar baz biff libfoo\n');
        });
        test('via --es-module-specifier-resolution alias', async () => {
          const {
            err,
            stdout,
          } = await exec(
            `${cmd} --experimental-modules --es-module-specifier-resolution=node index.ts`,
            { cwd: join(TEST_DIR, './esm-node-resolver') }
          );
          expect(err).to.equal(null);
          expect(stdout).to.equal('foo bar baz biff libfoo\n');
        });
        test('via NODE_OPTIONS', async () => {
          const { err, stdout } = await exec(`${cmd} index.ts`, {
            cwd: join(TEST_DIR, './esm-node-resolver'),
            env: {
              ...process.env,
              NODE_OPTIONS: `${experimentalModulesFlag} --experimental-specifier-resolution=node`,
            },
          });
          expect(err).to.equal(null);
          expect(stdout).to.equal('foo bar baz biff libfoo\n');
        });
      });

      test('throws ERR_REQUIRE_ESM when attempting to require() an ESM script when ESM loader is enabled', async () => {
        const { err, stderr } = await exec(`${cmd} ./index.js`, {
          cwd: join(TEST_DIR, './esm-err-require-esm'),
        });
        expect(err).to.not.equal(null);
        expect(stderr).to.contain(
          'Error [ERR_REQUIRE_ESM]: Must use import to load ES Module:'
        );
      });

      test('defers to fallback loaders when URL should not be handled by ts-node', async () => {
        const { err, stdout, stderr } = await exec(`${cmd} index.mjs`, {
          cwd: join(TEST_DIR, './esm-import-http-url'),
        });
        expect(err).to.not.equal(null);
        // expect error from node's default resolver
        expect(stderr).to.match(
          /Error \[ERR_UNSUPPORTED_ESM_URL_SCHEME\]:.*(?:\n.*){0,1}\n *at defaultResolve/
        );
      });

      test('should bypass import cache when changing search params', async () => {
        const { err, stdout } = await exec(`${cmd} index.ts`, {
          cwd: join(TEST_DIR, './esm-import-cache'),
        });
        expect(err).to.equal(null);
        expect(stdout).to.equal('log1\nlog2\nlog2\n');
      });

      test('should support transpile only mode via dedicated loader entrypoint', async () => {
        const { err, stdout } = await exec(`${cmd}/transpile-only index.ts`, {
          cwd: join(TEST_DIR, './esm-transpile-only'),
        });
        expect(err).to.equal(null);
        expect(stdout).to.equal('');
      });
      test('should throw type errors without transpile-only enabled', async () => {
        const { err, stdout } = await exec(`${cmd} index.ts`, {
          cwd: join(TEST_DIR, './esm-transpile-only'),
        });
        if (err === null) {
          throw new Error('Command was expected to fail, but it succeeded.');
        }

        expect(err.message).to.contain('Unable to compile TypeScript');
        expect(err.message).to.match(
          new RegExp(
            "TS2345: Argument of type '(?:number|1101)' is not assignable to parameter of type 'string'\\."
          )
        );
        expect(err.message).to.match(
          new RegExp(
            "TS2322: Type '(?:\"hello world\"|string)' is not assignable to type 'number'\\."
          )
        );
        expect(stdout).to.equal('');
      });
    }

    if (semver.gte(process.version, '12.0.0')) {
      test('throws ERR_REQUIRE_ESM when attempting to require() an ESM script when ESM loader is *not* enabled and node version is >= 12', async () => {
        // Node versions >= 12 support package.json "type" field and so will throw an error when attempting to load ESM as CJS
        const { err, stderr } = await exec(`${BIN_PATH} ./index.js`, {
          cwd: join(TEST_DIR, './esm-err-require-esm'),
        });
        expect(err).to.not.equal(null);
        expect(stderr).to.contain(
          'Error [ERR_REQUIRE_ESM]: Must use import to load ES Module:'
        );
      });
    } else {
      test('Loads as CommonJS when attempting to require() an ESM script when ESM loader is *not* enabled and node version is < 12', async () => {
        // Node versions less than 12 do not support package.json "type" field and so will load ESM as CommonJS
        const { err, stdout } = await exec(`${BIN_PATH} ./index.js`, {
          cwd: join(TEST_DIR, './esm-err-require-esm'),
        });
        expect(err).to.equal(null);
        expect(stdout).to.contain('CommonJS');
      });
    }
  });
});
