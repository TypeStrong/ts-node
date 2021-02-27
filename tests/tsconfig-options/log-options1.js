const assert = require('assert');
assert(process.required1);
const register = process[Symbol.for('ts-node.register.instance')];
console.log(
  JSON.stringify({
    options: register.options,
    config: register.config,
  })
);
