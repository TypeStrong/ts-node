export function resolve(specifier, context, defaultResolve) {
  console.log(JSON.stringify({ resolveContextKeys: Object.keys(context) }));
  return defaultResolve(specifier, context);
}
export function load(url, context, defaultLoad) {
  console.log(JSON.stringify({ loadContextKeys: Object.keys(context) }));
  return defaultLoad(url, context);
}
