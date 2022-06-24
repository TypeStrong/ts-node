import { strictEqual } from 'assert';
import { join, normalize } from 'path';

// Expect the working directory to be the current directory.
strictEqual(normalize(process.cwd()), normalize(join(__dirname, '../..')));

console.log('Passing');
