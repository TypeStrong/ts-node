import { expect } from 'chai';
import type { Key } from 'readline';
import semver = require('semver');
import { REPLStream } from './testlib';
import type * as tsNodeTypes from '../index';

interface SharedObjects
  extends Pick<typeof tsNodeTypes, 'create' | 'createRepl'> {
  TEST_DIR: string;
}

// Based on https://github.com/nodejs/node/blob/88799930794045795e8abac874730f9eba7e2300/test/parallel/test-repl-top-level-await.js
export async function upstreamTopLevelAwaitTests({
  TEST_DIR,
  create,
  createRepl,
}: SharedObjects) {
  const PROMPT = 'await repl > ';

  const putIn = new REPLStream();
  const replService = createRepl({
    // @ts-ignore
    stdin: putIn,
    // @ts-ignore
    stdout: putIn,
    // @ts-ignore
    stderr: putIn,
  });
  const service = create({
    ...replService.evalAwarePartialHost,
    project: `${TEST_DIR}/tsconfig.json`,
    experimentalReplAwait: true,
    transpileOnly: true,
    compilerOptions: {
      target: 'ES2018',
    },
  });
  replService.setService(service);
  (replService.stdout as NodeJS.WritableStream & {
    isTTY: boolean;
  }).isTTY = true;
  const replServer = replService.start(undefined, {
    prompt: PROMPT,
    terminal: true,
    useColors: true,
    useGlobal: false,
  });

  function runAndWait(cmds: Array<string | Key>) {
    const promise = putIn.wait();
    for (const cmd of cmds) {
      if (typeof cmd === 'string') {
        putIn.run([cmd]);
      } else {
        replServer.write('', cmd);
      }
    }
    return promise;
  }

  runAndWait([
    'function foo(x) { return x; }',
    'function koo() { return Promise.resolve(4); }',
  ]);

  const testCases = [
    ['await Promise.resolve(0)', '0'],

    // issue: { a: await Promise.resolve(1) } is being interpreted as a block
    // remove surrounding parenthesis once issue is fixed
    ['({ a: await Promise.resolve(1) })', '{ a: 1 }'],

    ['_', '{ a: 1 }'],
    ['let { aa, bb } = await Promise.resolve({ aa: 1, bb: 2 }), f = 5;'],
    ['aa', '1'],
    ['bb', '2'],
    ['f', '5'],
    ['let cc = await Promise.resolve(2)'],
    ['cc', '2'],
    ['let dd;'],
    ['dd'],
    ['let [ii, { abc: { kk } }] = [0, { abc: { kk: 1 } }];'],
    ['ii', '0'],
    ['kk', '1'],
    ['var ll = await Promise.resolve(2);'],
    ['ll', '2'],
    ['foo(await koo())', '4'],
    ['_', '4'],
    ['const m = foo(await koo());'],
    ['m', '4'],

    // issue: REPL doesn't recognize end of input
    // compile is returning TS1005 after second line even though
    // it's valid syntax
    // [
    //   'const n = foo(await\nkoo());',
    //   ['const n = foo(await\r', '... koo());\r', 'undefined'],
    // ],

    [
      '`status: ${(await Promise.resolve({ status: 200 })).status}`',
      "'status: 200'",
    ],
    ['for (let i = 0; i < 2; ++i) await i'],
    ['for (let i = 0; i < 2; ++i) { await i }'],
    ['await 0', '0'],
    ['await 0; function foo() {}'],
    ['foo', '[Function: foo]'],
    ['class Foo {}; await 1;', '1'],

    [
      'Foo',
      // Adjusted since ts-node supports older versions of node
      semver.gte(process.version, '12.18.0')
        ? '[class Foo]'
        : '[Function: Foo]',
    ],
    ['if (await true) { function fooz() {}; }'],
    ['fooz', '[Function: fooz]'],
    ['if (await true) { class Bar {}; }'],

    [
      'Bar',
      // Adjusted since ts-node supports older versions of node
      semver.gte(process.version, '12.16.0')
        ? 'Uncaught ReferenceError: Bar is not defined'
        : 'ReferenceError: Bar is not defined',
      // Line increased due to TS added lines
      {
        line: semver.gte(process.version, '12.16.0') ? 4 : 5,
      },
    ],

    ['await 0; function* gen(){}'],
    ['for (var i = 0; i < 10; ++i) { await i; }'],
    ['i', '10'],
    ['for (let j = 0; j < 5; ++j) { await j; }'],

    [
      'j',
      // Adjusted since ts-node supports older versions of node
      semver.gte(process.version, '12.16.0')
        ? 'Uncaught ReferenceError: j is not defined'
        : 'ReferenceError: j is not defined',
      // Line increased due to TS added lines
      {
        line: semver.gte(process.version, '12.16.0') ? 4 : 5,
      },
    ],

    ['gen', '[GeneratorFunction: gen]'],

    [
      'return 42; await 5;',
      // Adjusted since ts-node supports older versions of node
      semver.gte(process.version, '12.16.0')
        ? 'Uncaught SyntaxError: Illegal return statement'
        : 'SyntaxError: Illegal return statement',
      // Line increased due to TS added lines
      {
        line: semver.gte(process.version, '12.16.0') ? 4 : 5,
      },
    ],

    ['let o = await 1, p'],
    ['p'],
    ['let q = 1, s = await 2'],
    ['s', '2'],
    [
      'for await (let i of [1,2,3]) console.log(i)',
      [
        'for await (let i of [1,2,3]) console.log(i)\r',
        '1',
        '2',
        '3',
        'undefined',
      ],
    ],

    // issue: REPL is expecting more input to finish execution
    // compiler is returning TS1003 error
    // [
    //   'await Promise..resolve()',
    //   [
    //     'await Promise..resolve()\r',
    //     'Uncaught SyntaxError: ',
    //     'await Promise..resolve()',
    //     '              ^',
    //     '',
    //     "Unexpected token '.'",
    //   ],
    // ],

    [
      'for (const x of [1,2,3]) {\nawait x\n}',
      ['for (const x of [1,2,3]) {\r', '... await x\r', '... }\r', 'undefined'],
    ],
    [
      'for (const x of [1,2,3]) {\nawait x;\n}',
      [
        'for (const x of [1,2,3]) {\r',
        '... await x;\r',
        '... }\r',
        'undefined',
      ],
    ],
    [
      'for await (const x of [1,2,3]) {\nconsole.log(x)\n}',
      [
        'for await (const x of [1,2,3]) {\r',
        '... console.log(x)\r',
        '... }\r',
        '1',
        '2',
        '3',
        'undefined',
      ],
    ],
    [
      'for await (const x of [1,2,3]) {\nconsole.log(x);\n}',
      [
        'for await (const x of [1,2,3]) {\r',
        '... console.log(x);\r',
        '... }\r',
        '1',
        '2',
        '3',
        'undefined',
      ],
    ],
  ] as const;

  for (const [
    input,
    expected = [`${input}\r`],
    options = {} as { line?: number },
  ] of testCases) {
    const toBeRun = input.split('\n');
    const lines = await runAndWait(toBeRun);
    if (Array.isArray(expected)) {
      if (expected.length === 1) expected.push('undefined');
      if (lines[0] === input) lines.shift();
      expect(lines).to.eqls([...expected, PROMPT]);
    } else if ('line' in options) {
      expect(lines[toBeRun.length + options.line!]).to.eqls(expected);
    } else {
      const echoed = toBeRun.map((a, i) => `${i > 0 ? '... ' : ''}${a}\r`);
      expect(lines).to.eqls([...echoed, expected, PROMPT]);
    }
  }
}
