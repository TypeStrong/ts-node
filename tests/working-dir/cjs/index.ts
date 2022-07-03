import { strictEqual } from 'assert';
import { normalize } from 'path';

// Expect the working directory to be the current directory.
strictEqual(normalize(process.cwd()), normalize(__dirname));

console.log('Passing');
