if (typeof module !== 'undefined') throw new Error('module should not exist in ESM');

// intentional type errors to check transpile-only ESM loader skips type checking
parseInt(1101, 2);
const x: number = 'hello world';
