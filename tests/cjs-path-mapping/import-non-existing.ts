// Should fail to import non-existing file
const nonExisting = require('non-existing.js');

// Pretend we want to use it
console.log(nonExisting);

// Force this to be a module
export {};
