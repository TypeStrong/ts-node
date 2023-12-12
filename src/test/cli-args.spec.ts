import { context } from './testlib';
import { ctxTsNode, testsDirRequire } from './helpers';
import type { ParsedArgv } from '../bin';
const test = context(ctxTsNode);

const argParseMacro = test.macro(
  (args: string[], entrypointArgs: Record<string, any> | undefined, expectation: Partial<ParsedArgv>) => [
    () => `"${args.join(' ')}"${entrypointArgs ? ` w/entrypoint args: ${JSON.stringify(entrypointArgs)}` : ``}`,
    async (t) => {
      const parsedArgs = t.context.tsNodeBin.parseArgv(args, entrypointArgs ?? {});
      t.like(parsedArgs, expectation);
    },
  ]
);

test(argParseMacro, ['-pe', '123'], undefined, {
  print: true,
  code: '123',
  restArgs: [],
});

test(argParseMacro, ['-p', '123'], undefined, {
  print: true,
  code: '123',
  restArgs: [],
});

test(argParseMacro, ['-e', '123'], undefined, {
  print: false,
  code: '123',
  restArgs: [],
});
