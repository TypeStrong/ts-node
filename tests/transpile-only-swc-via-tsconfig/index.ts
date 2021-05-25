// Test for #1343
const Decorator = function() {}
@Decorator
class World {}

// intentional type errors to check transpile-only ESM loader skips type checking
parseInt(1101, 2);
const x: number = `Hello ${ World.name }`;
console.log(x);
