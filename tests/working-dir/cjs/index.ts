import { strictEqual } from 'assert';
import { normalize, dirname } from 'path';

// Expect the working directory to be the parent directory.
strictEqual(normalize(process.cwd()), normalize(dirname(__dirname)));

console.log('Passing');
