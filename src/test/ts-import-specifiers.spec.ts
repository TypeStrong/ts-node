import { context } from './testlib';
import * as expect from 'expect';
import { createExec } from './helpers/exec';
import { TEST_DIR, ctxTsNode, CMD_TS_NODE_WITHOUT_PROJECT_FLAG, tsSupportsAllowImportingTsExtensions } from './helpers';
import { project as fsProject } from '@TypeStrong/fs-fixture-builder';
import { outdent as o } from 'outdent';

const exec = createExec({
  cwd: TEST_DIR,
});

const test = context(ctxTsNode);

test('Supports .ts extensions in import specifiers with typechecking, even though older versions of TS checker do not', async () => {
  const p = fsProject('ts-import-specifiers');
  p.rm();
  p.addFile(
    'index.ts',
    o`
    import { foo } from './foo.ts';
    import { bar } from './bar.jsx';
    console.log({ foo, bar });
  `
  );
  p.addFile(
    'foo.ts',
    o`
    export const foo = true;
  `
  );
  p.addFile(
    'bar.tsx',
    o`
    export const bar = true;
  `
  );
  p.addJsonFile('tsconfig.json', {
    'ts-node': {
      // Can eventually make this a stable feature.  For now, `experimental` flag allows me to iterate quickly
      experimentalTsImportSpecifiers: true,
      experimentalResolver: true,
    },
    compilerOptions: {
      jsx: 'react',
      allowImportingTsExtensions: tsSupportsAllowImportingTsExtensions ? true : undefined,
    },
  });
  p.write();

  const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} ./index.ts`, {
    cwd: p.cwd,
  });
  expect(r.err).toBe(null);
  expect(r.stdout.trim()).toBe('{ foo: true, bar: true }');
});
