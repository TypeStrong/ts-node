import { spawnSync } from 'child_process';
const { npm_node_execpath, npm_execpath } = process.env;
import { readFileSync } from 'fs';

// prepack is executed by user's package manager when they install from git
// So cannot assume yarn

if (process.env.TS_NODE_SKIP_PREPACK == null) {
  if (readFileSync(npm_execpath, 'utf8').match(/^#!.*sh/)) {
    spawnSync(npm_execpath, ['run', 'prepack-worker'], {
      stdio: 'inherit',
    });
  } else {
    spawnSync(npm_node_execpath, [npm_execpath, 'run', 'prepack-worker'], {
      stdio: 'inherit',
    });
  }
}
