import * as expect from 'expect';
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
  projectDir: string
) => {
  const partialExec = createExec({
    cwd: join(TEST_DIR, moduleDir, projectDir),
  });

  return (file = 'index.ts') => partialExec(`${command} ${file}`);
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
  esm: { baseDir: 'esm-path-mapping', command: CMD_ESM_LOADER_WITHOUT_PROJECT },
};

const PROJECT_CONFIG_DIRS = {
  BASE_URL_NO_PATHS: 'base-url-no-paths',
  BASE_URL_AND_PATHS: 'base-url-and-paths',
  BASE_URL_STAR_PATH: 'base-url-star-path',
};

for (const moduleType of MODULE_TYPES) {
  test.suite(`path mapping ${moduleType}`, (test) => {
    test.runIf(nodeSupportsEsmHooks || moduleType !== MODULE_TYPE_ESM);

    for (const project of Object.values(PROJECT_CONFIG_DIRS)) {
      // Create ts-node runner for this config
      const exec = execBuilder(
        EXEC_BUILDER_PARAMS[moduleType].command,
        EXEC_BUILDER_PARAMS[moduleType].baseDir,
        project
      );

      test(`fallback to node built-in with ${project}`, async () => {
        const { err } = await exec('import-node-built-in.ts');
        expect(err).toBe(null);
      });

      // test('fallback to node_modules', async (t) => {
      //   const { err } = await exec('import-node-modules.ts');
      //   expect(err).toBe(null);
      // });

      // test('external modules ignore paths', async () => {
      //   const { err } = await exec('import-within-node-modules.ts');
      //   expect(err).toBe(null);
      // });

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
    }

    // const PROJECTS_WITH_PATHS = [PROJECTS.BASE_URL_AND_PATHS, PROJECTS.BASE_URL_STAR_PATH];
    // for(const project of PROJECTS_WITH_PATHS) {
    //   // Create ts-node runner for this config
    //   const exec = execBuilder(project);

    //   test(`import specific paths with ${project}`, async () => {
    //     const { err } = await exec('???');
    //     expect(err).toBe(null);
    //   });
    // }
  });
}
