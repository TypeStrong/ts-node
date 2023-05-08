const { npm_execpath } = process.env;

// prepack is executed by user's package manager when they install from git
// So cannot assume yarn

if (process.env.TS_NODE_SKIP_PREPACK == null) {
  const crossSpawn = await import('cross-spawn');
  const result = crossSpawn.sync(npm_execpath, ['run', 'prepack-worker'], {
    stdio: 'inherit',
  });
  process.exit(result.status);
}
