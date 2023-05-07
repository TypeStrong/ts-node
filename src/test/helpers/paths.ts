import { setFixturesRootDir } from '@TypeStrong/fs-fixture-builder';
import { join, resolve } from 'path';

//#region Paths
export const ROOT_DIR = resolve(__dirname, '../../..');
export const DIST_DIR = resolve(__dirname, '../..');
export const TEST_DIR = join(__dirname, '../../../tests');
export const PROJECT = join(TEST_DIR, 'tsconfig.json');
export const PROJECT_TRANSPILE_ONLY = join(TEST_DIR, 'tsconfig-transpile-only.json');
export const BIN_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node');
export const BIN_PATH_JS = join(TEST_DIR, 'node_modules/ts-node/dist/bin.js');
export const BIN_SCRIPT_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node-script');
export const BIN_CWD_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node-cwd');
export const BIN_ESM_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node-esm');

process.chdir(TEST_DIR);
setFixturesRootDir(TEST_DIR);
//#endregion
