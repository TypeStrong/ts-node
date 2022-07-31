// No-op plugin to disable yarn's own plugin-compat, preventing any unexpected
// modifications to the typescript package and others
module.exports = {
  name: `@yarnpkg/plugin-compat`,
  factory: require => ({})
};
