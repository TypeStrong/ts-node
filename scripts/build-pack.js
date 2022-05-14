// Written in JS to support Windows
// Would otherwise be written as inline bash in package.json script

const { exec } = require('child_process');
const {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  rmdirSync,
  readdirSync,
} = require('fs');
const { join } = require('path');

const testDir = join(__dirname, '../tests');
const tarballPath = join(testDir, 'ts-node-packed.tgz');
const tempDir = mkdtempSync(join(testDir, 'tmp'));
exec(
  `npm pack --ignore-scripts "${join(__dirname, '..')}"`,
  { cwd: tempDir },
  (err, stdout) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    const tempTarballPath = join(tempDir, readdirSync(tempDir).find(name => name.endsWith('.tgz')));
    writeFileSync(tarballPath, readFileSync(tempTarballPath));
    unlinkSync(tempTarballPath);
    rmdirSync(tempDir);
  }
);
