import { test } from './testlib';
import * as expect from 'expect';
import {
  CMD_ESM_LOADER_WITHOUT_PROJECT,
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  nodeSupportsEsmHooks,
  TEST_DIR,
} from './helpers';
import { join } from 'path';
import { createExec } from './exec-helpers';

const exec = createExec({
  cwd: TEST_DIR,
});

test.suite('path mapping cjs', (test) => {
  test('path mapping', async () => {
    const { err } = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} index.ts`, {
      cwd: join(TEST_DIR, './cjs-path-mapping'),
    });
    expect(err).toBe(null);
  });

  test('path mapping error candidates', async () => {
    const { stderr, err } = await exec(
      `${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} mapped-not-found.ts`,
      {
        cwd: join(TEST_DIR, './cjs-path-mapping'),
      }
    );
    expect(err).toBeTruthy();
    expect(stderr).toMatch(
      `[MODULE_NOT_FOUND]: Cannot find 'map2/does-not-exist.ts'`
    );
    // Expect tried candidates to be listed
    expect(stderr).toMatch(/- .*mapped\/2-does-not-exist.ts/);
    expect(stderr).toMatch(/- .*mapped\/2a-does-not-exist.ts/);
  });
});

test.suite('path mapping esm', (test) => {
  test.runIf(nodeSupportsEsmHooks);

  test('path mapping', async () => {
    const { err } = await exec(`${CMD_ESM_LOADER_WITHOUT_PROJECT} index.ts`, {
      cwd: join(TEST_DIR, './esm-path-mapping'),
    });
    expect(err).toBe(null);
  });

  test('path mapping error candidates', async () => {
    const { stderr, err } = await exec(
      `${CMD_ESM_LOADER_WITHOUT_PROJECT} mapped-not-found.ts`,
      {
        cwd: join(TEST_DIR, './esm-path-mapping'),
      }
    );
    expect(err).toBeTruthy();
    expect(stderr).toMatch(
      `[ERR_MODULE_NOT_FOUND]: Cannot find 'map2/does-not-exist.ts'`
    );
    // Expect tried candidates to be listed
    expect(stderr).toMatch(/- file:\/\/.*mapped\/2-does-not-exist.ts/);
    expect(stderr).toMatch(/- file:\/\/.*mapped\/2a-does-not-exist.ts/);
  });

  test('baseUrl set and no paths', async () => {
    const { err } = await exec(
      `${CMD_ESM_LOADER_WITHOUT_PROJECT} baseurl-no-paths.ts`,
      {
        cwd: join(TEST_DIR, './esm-path-mapping'),
        env: {
          ...process.env,
          TS_NODE_PROJECT: `./tsconfig-baseurl-no-paths.json`,
        },
      }
    );
    expect(err).toBe(null);
  });

  test('baseUrl set and * path', async () => {
    const { err } = await exec(
      `${CMD_ESM_LOADER_WITHOUT_PROJECT} baseurl-star-path.ts`,
      {
        cwd: join(TEST_DIR, './esm-path-mapping'),
        env: {
          ...process.env,
          TS_NODE_PROJECT: `./tsconfig-baseurl-star-path.json`,
        },
      }
    );
    expect(err).toBe(null);
  });

  test('fallback to node_modules', async (t) => {
    const { stdout, stderr, err } = await exec(
      `${CMD_ESM_LOADER_WITHOUT_PROJECT} node-modules-star-path.ts`,
      {
        cwd: join(TEST_DIR, './esm-path-mapping'),
        env: {
          ...process.env,
          TS_NODE_PROJECT: `./tsconfig-baseurl-star-path.json`,
        },
      }
    );
    t.log({ stdout, stderr });
    expect(err).toBe(null);
  });

  test('fallback to Node built-in', async () => {
    const { err } = await exec(
      `${CMD_ESM_LOADER_WITHOUT_PROJECT} built-in-star-path.ts`,
      {
        cwd: join(TEST_DIR, './esm-path-mapping'),
        env: {
          ...process.env,
          TS_NODE_PROJECT: `./tsconfig-baseurl-star-path.json`,
        },
      }
    );
    expect(err).toBe(null);
  });

  test('skip type definitions', async () => {
    const { err } = await exec(
      `${CMD_ESM_LOADER_WITHOUT_PROJECT} type-definition.ts`,
      {
        cwd: join(TEST_DIR, './esm-path-mapping'),
        env: {
          ...process.env,
          TS_NODE_PROJECT: `./tsconfig-baseurl-no-paths.json`,
        },
      }
    );
    expect(err).toBe(null);
  });

  test('external modules ignore paths', async () => {
    const { err } = await exec(
      `${CMD_ESM_LOADER_WITHOUT_PROJECT} node-modules-import.ts`,
      {
        cwd: join(TEST_DIR, './esm-path-mapping'),
        env: {
          ...process.env,
          TS_NODE_PROJECT: `./tsconfig-lodash-path.json`,
        },
      }
    );
    expect(err).toBe(null);
  });

  test('relative imports should ignore paths', async () => {
    const { stderr, err } = await exec(
      `${CMD_ESM_LOADER_WITHOUT_PROJECT} path-relative.ts`,
      {
        cwd: join(TEST_DIR, './esm-path-mapping'),
        env: {
          ...process.env,
          TS_NODE_PROJECT: `./tsconfig-baseurl-star-path.json`,
        },
      }
    );
    expect(err).toBeTruthy();
    expect(stderr).toMatch(`[ERR_MODULE_NOT_FOUND]: Cannot find './1-foo'`);
    // Expect tried candidates to be listed
    expect(stderr).toMatch(/- file:\/\/.*level-1\/1-foo.ts/);
  });

  test('base relative imports should ignore paths', async () => {
    const { stderr, err } = await exec(
      `${CMD_ESM_LOADER_WITHOUT_PROJECT} path-base-relative.ts`,
      {
        cwd: join(TEST_DIR, './esm-path-mapping'),
        env: {
          ...process.env,
          TS_NODE_PROJECT: `./tsconfig-baseurl-star-path.json`,
        },
      }
    );
    expect(err).toBeTruthy();
    expect(stderr).toMatch(`[ERR_MODULE_NOT_FOUND]: Cannot find '/1-foo'`);
    // Expect tried candidates to be listed
    expect(stderr).toMatch(/- file:\/\/.*level-1\/1-foo.ts/);
  });
});
