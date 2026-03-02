const moduleName = require.resolve('./module');

const { example: example1 } = require(moduleName);
delete require.cache[moduleName];
const { example: example2 } = require(moduleName);

export { example1, example2 };
