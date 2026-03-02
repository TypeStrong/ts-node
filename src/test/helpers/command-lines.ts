// Command lines

import { BIN_PATH, PROJECT, PROJECT_TRANSPILE_ONLY } from './paths';

/** Default `ts-node --project` invocation */
export const CMD_TS_NODE_WITH_PROJECT_FLAG = `"${BIN_PATH}" --project "${PROJECT}"`;
/** Default `ts-node --project` invocation with transpile-only */
export const CMD_TS_NODE_WITH_PROJECT_TRANSPILE_ONLY_FLAG = `"${BIN_PATH}" --project "${PROJECT_TRANSPILE_ONLY}"`;
/** Default `ts-node` invocation without `--project` */
export const CMD_TS_NODE_WITHOUT_PROJECT_FLAG = `"${BIN_PATH}"`;
export const CMD_ESM_LOADER_WITHOUT_PROJECT = `node --loader ts-node/esm`;
//#endregion
