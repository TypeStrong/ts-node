import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

// NOTE: could be replaced with using https://npm.im/yarpm

const manifestPath = resolve(fileURLToPath(import.meta.url), '../../package.json');
const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Fully splat the "prepack" script so that it does not contain references to a package manager, neither `yarn` nor `npm`
let before;
let prepack = pkg.scripts.__prepack_template__;
while (before !== prepack) {
  before = prepack;
  prepack = prepack.replace(/yarn (\S+)/g, ($0, $1) => pkg.scripts[$1]);
}
pkg.scripts['prepack-worker'] = prepack;

writeFileSync(manifestPath, JSON.stringify(pkg, null, 2) + '\n');
