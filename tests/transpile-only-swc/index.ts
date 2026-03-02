// Test for #1343
const Decorator = function () {};
@Decorator
class World {}

// intentional type errors to check transpile-only ESM loader skips type checking
parseInt(1101, 2);
const x: number = `Hello ${World.name}! swc transpiler invocation count: ${global.swcTranspilerCalls}`;
console.log(x);

// test module type emit
import { readFileSync } from 'fs';
readFileSync;
