import { lstatSync } from 'fs';
import { join } from 'path';
import { BIN_CWD_PATH, BIN_PATH, BIN_SCRIPT_PATH, createExec, ctxTsNode, TEST_DIR } from '../helpers';
import { context, expect } from '../testlib';

const exec = createExec({
  cwd: TEST_DIR,
});

const test = context(ctxTsNode);

test('should locate tsconfig relative to entry-point by default', async () => {
  const r = await exec(`${BIN_PATH} ../a/index`, {
    cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
  });
  expect(r.err).toBe(null);
  expect(r.stdout).toMatch(/plugin-a/);
});
test('should locate tsconfig relative to entry-point via ts-node-script', async () => {
  const r = await exec(`${BIN_SCRIPT_PATH} ../a/index`, {
    cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
  });
  expect(r.err).toBe(null);
  expect(r.stdout).toMatch(/plugin-a/);
});
test('should locate tsconfig relative to entry-point with --script-mode', async () => {
  const r = await exec(`${BIN_PATH} --script-mode ../a/index`, {
    cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
  });
  expect(r.err).toBe(null);
  expect(r.stdout).toMatch(/plugin-a/);
});
test('should locate tsconfig relative to cwd via ts-node-cwd', async () => {
  const r = await exec(`${BIN_CWD_PATH} ../a/index`, {
    cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
  });
  expect(r.err).toBe(null);
  expect(r.stdout).toMatch(/plugin-b/);
});
test('should locate tsconfig relative to cwd in --cwd-mode', async () => {
  const r = await exec(`${BIN_PATH} --cwd-mode ../a/index`, {
    cwd: join(TEST_DIR, 'cwd-and-script-mode/b'),
  });
  expect(r.err).toBe(null);
  expect(r.stdout).toMatch(/plugin-b/);
});
test('should locate tsconfig relative to realpath, not symlink, when entrypoint is a symlink', async (t) => {
  if (lstatSync(join(TEST_DIR, 'main-realpath/symlink/symlink.tsx')).isSymbolicLink()) {
    const r = await exec(`${BIN_PATH} main-realpath/symlink/symlink.tsx`);
    expect(r.err).toBe(null);
    expect(r.stdout).toBe('');
  } else {
    t.log('Skipping');
    return;
  }
});
