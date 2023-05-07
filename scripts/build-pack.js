// Written in JS to support Windows
// Would otherwise be written as inline bash in package.json script

const { exec } = require('child_process');
const { join } = require('path');

const rootDir = join(__dirname, '..');
const testDir = join(__dirname, '../tests');
const tarballPath = join(testDir, 'ts-node-packed.tgz');

const env = {
  ...process.env,
  TS_NODE_SKIP_PREPACK: 'true',
};

exec(`yarn pack --out "${tarballPath}"`, { cwd: rootDir, env }, (err, stdout) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
});
