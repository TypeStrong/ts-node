export {};
// Type assertion to please TS 2.7
const register = process[(Symbol as any).for('ts-node.register.instance')];
console.log(
  JSON.stringify({
    options: register.options,
    config: register.config,
  })
);
