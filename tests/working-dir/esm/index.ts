import { ok } from 'assert';

// Expect the working directory to be the current directory.
// Note: Cannot use `import.meta.url` in this variant of the test
// because older TypeScript versions do not know about this syntax.
ok(/working-dir[\/\\]esm[\/\\]?/.test(process.cwd()));

console.log('Passing');
