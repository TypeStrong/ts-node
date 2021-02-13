export {}
const register = process[Symbol.for('ts-node.register.instance')]
console.log(JSON.stringify({
  options: register.options,
  config: register.config
}))
