import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const manifestPath = resolve(
  fileURLToPath(import.meta.url),
  '../../package.json'
);
const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));

// Fully splat the "prepare" script so that it does not contain references to a package manager, neither `yarn` nor `npm`
pkg.scripts.prepare = pkg.scripts.__prepare_template__;
while (true) {
  let before = pkg.scripts.prepare;
  pkg.scripts.prepare = pkg.scripts.prepare.replace(
    /yarn (\S+)/g,
    ($0, $1) => pkg.scripts[$1]
  );
  if (pkg.scripts.prepare === before) break;
}

writeFileSync(manifestPath, JSON.stringify(pkg, null, 2) + '\n');
