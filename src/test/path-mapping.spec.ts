import { join } from 'path';

import { createExec } from './exec-helpers';
import {
  CMD_ESM_LOADER_WITHOUT_PROJECT,
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  nodeSupportsEsmHooks,
  TEST_DIR,
  installTsNode,
} from './helpers';
import { test, expect } from './testlib';

test.beforeAll(installTsNode);

function execBuilder(
  command: string,
  moduleDir: string,
  tsConfig: string = 'tsconfig.json'
) {
  const partialExec = createExec({
    cwd: join(TEST_DIR, moduleDir),
    env: { ...process.env, TS_NODE_PROJECT: tsConfig },
  });

  return (file = 'index.ts') => partialExec(`${command} ${file}`);
}

const MODULE_TYPES = {
  CJS: {
    name: 'cjs',
    baseDir: 'cjs-path-mapping',
    command: CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  },
  ESM: {
    name: 'esm',
    baseDir: 'esm-path-mapping',
    command: CMD_ESM_LOADER_WITHOUT_PROJECT,
  },
} as const;

const PROJECT_CONFIGS = <const>{
  BASE_URL_NO_PATHS: 'tsconfig-baseurl-no-paths.json',
  BASE_URL_SOME_PATHS: 'tsconfig-baseurl-some-paths.json',
  BASE_URL_STAR_PATH: 'tsconfig-baseurl-star-path.json',
};

for (const moduleType of Object.values(MODULE_TYPES)) {
  test.suite(`path mapping ${moduleType.name}`, (test) => {
    test.runIf(
      nodeSupportsEsmHooks || moduleType.name !== MODULE_TYPES.ESM.name
    );

    for (const project of Object.values(PROJECT_CONFIGS)) {
      // Create ts-node runner for this config
      const exec = execBuilder(moduleType.command, moduleType.baseDir, project);

      test.suite(`${project}`, (test) => {
        test('ignore type definitions', async (t) => {
          const { err } = await exec('ignore-type-definitions.ts');
          expect(err).toBeNull();
        });

        test(`fallback to node built-in`, async (t) => {
          const {err} = await exec('import-node-built-in.ts');
          expect(err).toBe(null);
        });

        test(`import at baseUrl`, async () => {
          const { err } = await exec('import-at-base.ts');
          expect(err).toBeNull();
        });

        test(`import at baseUrl without file extensions`, async () => {
          const { err } = await exec('import-at-base-no-extensions.ts');
          expect(err).toBeNull();
        });

        test(`import below baseUrl`, async () => {
          const { err } = await exec('import-below-base.ts');
          expect(err).toBeNull();
        });

        test(`import from js, jsx, tsx`, async () => {
          const { err } = await exec('import-from-js-jsx-tsx.ts');
          expect(err).toBeNull();
        });

        test(`import node built-in`, async (t) => {
          const { err } = await exec('import-node-built-in.ts');
          expect(err).toBeNull();
        });

        test(`import node_modules`, async (t) => {
          const { err } = await exec('import-node-modules.ts');
          expect(err).toBeNull();
        });

        test(`import within node_modules ignores paths`, async (t) => {
          const { err } = await exec('import-within-node-modules.ts');
          expect(err).toBeNull();
        });

        test('import relative', async () => {
          const { err } = await exec('import-relative.ts');
          expect(err).toBeNull();
        });

        test(`import invalid path should error & list candidates`, async () => {
          const { err, stderr } = await exec('import-non-existing.ts');
          expect(err).toBeTruthy();
          expect(stderr).toMatch(
            `[ERR_MODULE_NOT_FOUND]: Cannot find 'non-existing.js'`
          );
          expect(stderr).toMatch(/- file:\/\/.*non-existing.js/);
        });
      });
    }

    test.suite(`${PROJECT_CONFIGS.BASE_URL_STAR_PATH} only`, (test) => {
      const exec = execBuilder(
        moduleType.command,
        moduleType.baseDir,
        PROJECT_CONFIGS.BASE_URL_STAR_PATH
      );

      test('import relative should not succeed using star-path', async (t) => {
        const { err, stderr } = await exec('import-relative-ignores-star.ts');
        expect(err).toBeTruthy();
        expect(stderr).toMatch(
          `[ERR_MODULE_NOT_FOUND]: Cannot find './should-not-resolve'`
        );
      });
    });

    test.suite(`${PROJECT_CONFIGS.BASE_URL_SOME_PATHS} only`, (test) => {
      const exec = execBuilder(
        moduleType.command,
        moduleType.baseDir,
        PROJECT_CONFIGS.BASE_URL_SOME_PATHS
      );

      test('map using a prefix', async (t) => {
        const { err } = await exec('map-using-prefix.ts');
        expect(err).toBeNull();
      });

      test('map to js, jsx, tsx', async (t) => {
        const { err } = await exec('map-to-js-jsx-tsx.ts');
        expect(err).toBeNull();
      });

      test('map to first available candidate', async (t) => {
        const { err } = await exec('map-to-first-available-candidate.ts');
        expect(err).toBeNull();
      });

      test('map using more specific candidate', async (t) => {
        const { err } = await exec('map-using-more-specific-path.ts');
        expect(err).toBeNull();
      });

      test('map to static (no wildcard)', async (t) => {
        const { err } = await exec('map-using-static-path.ts');
        expect(err).toBeNull();
      });

      test('map from js, jsx, tsx', async (t) => {
        const { err } = await exec('map-from-js-jsx-tsx.ts');
        expect(err).toBeNull();
      });
    });
  });
}
