#!/usr/bin/env -S ts-node --esm --transpileOnly
import { existsSync, mkdirSync } from 'fs';
import { unlinkSync, rmdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { $ } from '@cspotcode/zx';

async function main() {
  const __root = dirname(__dirname);
  const downloadDir = resolve(__root, 'temp/node-nightly');
  const result = await fetch('https://nodejs.org/download/nightly/index.json');
  const index = await result.json();
  const latest = index[0];
  const { version } = latest;
  existsSync(downloadDir) && rmdirSync(downloadDir, { recursive: true });
  mkdirSync(downloadDir, { recursive: true });
  await $`wget -O ${downloadDir}/download.tar.gz https://nodejs.org/download/nightly/${version}/node-${version}-linux-x64.tar.gz`;
  process.chdir(downloadDir);
  await $`tar -xzvf ${downloadDir}/download.tar.gz node-${version}-linux-x64/bin/node`;

  console.log(``);
  console.log(
    `export PATH="${downloadDir}/node-${version}-linux-x64/bin:$PATH"`
  );
  console.log(``);
}

main();
