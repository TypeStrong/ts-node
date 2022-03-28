// Should fail to import relative import that would need to apply a path
import shouldNotResolve from './should-not-resolve';

// Pretend we want to use it
console.log(shouldNotResolve);
