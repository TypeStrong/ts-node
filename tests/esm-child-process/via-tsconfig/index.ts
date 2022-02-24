import assert from 'assert';
assert(import.meta.url.includes('index.ts'));
console.log(`CLI args: ${process.argv.slice(2).join(' ')}`);
