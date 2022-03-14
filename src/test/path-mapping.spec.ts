import { join } from 'path';

import { createExec } from './exec-helpers';
import {
  CMD_ESM_LOADER_WITHOUT_PROJECT,
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  nodeSupportsEsmHooks,
  TEST_DIR,
} from './helpers';
import { test } from './testlib';

const execBuilder = (
  command: string,
  moduleDir: string,
  tsConfig: string = 'tsconfig.json'
) => {
  const partialExec = createExec({
    cwd: join(TEST_DIR, moduleDir),
    env: { ...process.env, TS_NODE_PROJECT: tsConfig },
  });

  return (file = 'index.ts', throwErrors = true) =>
    partialExec(`${command} ${file}`).then((res) => {
      if (throwErrors && res.err) throw res.err;
      return res;
    });
};

type ModuleType = 'cjs' | 'esm';
const MODULE_TYPES: ModuleType[] = ['cjs', 'esm'];
const MODULE_TYPE_ESM = MODULE_TYPES[1];

type ExecBuilderParams = { baseDir: string; command: string };
const EXEC_BUILDER_PARAMS: Record<ModuleType, ExecBuilderParams> = {
  cjs: {
    baseDir: 'cjs-path-mapping',
    command: CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  },
  esm: {
    baseDir: 'esm-path-mapping',
    command: CMD_ESM_LOADER_WITHOUT_PROJECT,
  },
};

const PROJECT_CONFIGS = {
  BASE_URL_NO_PATHS: 'tsconfig-baseurl-only.json',
  BASE_URL_AND_PATHS: 'tsconfig.json',
  BASE_URL_STAR_PATH: 'tsconfig-star-path.json',
};

for (const moduleType of MODULE_TYPES) {
  test.suite(`path mapping ${moduleType}`, (test) => {
    test.runIf(nodeSupportsEsmHooks || moduleType !== MODULE_TYPE_ESM);
    const execBuilderParams = EXEC_BUILDER_PARAMS[moduleType];

    for (const project of Object.values(PROJECT_CONFIGS)) {
      // Create ts-node runner for this config
      const exec = execBuilder(
        execBuilderParams.command,
        execBuilderParams.baseDir,
        project
      );

      test.suite(`project: ${project}`, (test) => {
        test(`fallback to node built-in`, async (t) => {
          await t.notThrowsAsync(exec('import-node-built-in.ts'));
        });

        test(`fallback to node_modules`, async (t) => {
          await t.notThrowsAsync(exec('import-node-modules.ts'));
        });

        test(`imports within node_modules ignore paths`, async (t) => {
          await t.notThrowsAsync(exec('import-within-node-modules.ts'));
        });

        // test('ignore type definitions', async () => {
        //   const { err } = await exec('ignore-type-definitions');
        //   expect(err).toBe(null);
        // });

        // test(`import from baseUrl with ${project}`, async () => {
        //   const { err } = await exec('import-from-base.ts');
        //   expect(err).toBe(null);
        // });

        // test(`import under baseUrl with ${project}`, async () => {
        //   const { err } = await exec('import-under-base.ts');
        //   expect(err).toBe(null);
        // });

        // test(`import from js, js, tsx with ${project}`, async () => {
        //   const { err } = await exec('import-from-base.ts');
        //   expect(err).toBe(null);
        // });

        // test('relative imports should ignore paths', async () => {
        //   const { err } = await exec('import-relative.ts');
        //   expect(err).toBe(null);
        // });

        // test(`import invalid path with ${project}`, async () => {
        //   const { stderr, err } = await exec('import-non-existing.ts');

        //   // Expect error
        //   expect(err).toBeTruthy();
        //   expect(stderr).toMatch(
        //     `[ERR_MODULE_NOT_FOUND]: Cannot find 'map2/does-not-exist.ts'`
        //   );

        //   // Expect tried candidates to be listed
        //   expect(stderr).toMatch(/- file:\/\/.*mapped\/2-does-not-exist.ts/);
        //   expect(stderr).toMatch(/- file:\/\/.*mapped\/2a-does-not-exist.ts/);
        // });
      });
    }

    // // Create ts-node runner config with paths
    // const exec = execBuilder(
    //   execBuilderParams.command,
    //   execBuilderParams.baseDir,
    //   PROJECT_CONFIGS.BASE_URL_AND_PATHS
    // );

    // test(`import specific paths`, async () => {
    //   const { err } = await exec('???');
    //   expect(err).toBe(null);
    // });
  });
}
