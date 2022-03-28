// Should fail to import relative import that would need to apply a path
const shouldNotResolve = require('./should-not-resolve');

// Pretend we want to use it
console.log(shouldNotResolve);

// Force this to be a module
export {};
