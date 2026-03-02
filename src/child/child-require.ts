interface EventEmitterInternals {
  _events: Record<string, Function | Array<Function>>;
}
const _process = process as any as EventEmitterInternals;

// Not shown here: Additional logic to correctly interact with process's events, either using this direct manipulation, or via the API

let originalOnWarning: Function | undefined;
if (Array.isArray(_process._events.warning)) {
  originalOnWarning = _process._events.warning[0];
  _process._events.warning[0] = onWarning;
} else {
  originalOnWarning = _process._events.warning;
  _process._events.warning = onWarning;
}

const messageMatch = /(?:--(?:experimental-)?loader\b|\bCustom ESM Loaders\b)/;
function onWarning(this: any, warning: Error, ...rest: any[]) {
  // Suppress warning about how `--loader` is experimental
  if (warning?.name === 'ExperimentalWarning' && messageMatch.test(warning?.message)) return;
  // Will be undefined if `--no-warnings`
  return originalOnWarning?.call(this, warning, ...rest);
}
