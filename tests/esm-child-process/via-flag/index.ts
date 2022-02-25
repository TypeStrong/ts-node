import { strictEqual } from 'assert';
strictEqual(import.meta.url.includes('index.ts'), true);
console.log(`CLI args: ${process.argv.slice(2).join(' ')}`);
