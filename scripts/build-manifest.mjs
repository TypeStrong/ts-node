import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

// NOTE: could be replaced with using https://npm.im/yarpm

const manifestPath = resolve(
  fileURLToPath(import.meta.url),
  '../../package.json'
);
const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Fully splat the "prepack" script so that it does not contain references to a package manager, neither `yarn` nor `npm`
pkg.scripts.prepack = pkg.scripts.__prepack_template__;
while (true) {
  let before = pkg.scripts.prepack;
  pkg.scripts.prepack = pkg.scripts.prepack.replace(
    /yarn (\S+)/g,
    ($0, $1) => pkg.scripts[$1]
  );
  if (pkg.scripts.prepack === before) break;
}

writeFileSync(manifestPath, JSON.stringify(pkg, null, 2) + '\n');
