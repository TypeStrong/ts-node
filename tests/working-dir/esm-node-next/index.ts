import { strictEqual } from 'assert';
import { normalize, dirname } from 'path';
import { fileURLToPath } from 'url';

// Expect the working directory to be the current directory.
strictEqual(
  normalize(process.cwd()),
  normalize(dirname(fileURLToPath(import.meta.url)))
);

console.log('Passing');
