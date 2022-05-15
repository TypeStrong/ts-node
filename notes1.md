const patterns = getRegularExpressionsForWildcards(specs, basePath, usage);
const pattern = patterns.map(pattern => `(${pattern})`).join("|");
// If excluding, match "foo/bar/baz...", but if including, only allow "foo".
const terminator = usage === "exclude" ? "($|/)" : "$";
return `^(${pattern})${terminator}`;


const pattern = spec && getSubPatternFromSpec(spec, basePath, usage, wildcardMatchers[usage]);
return pattern && `^(${pattern})${usage === "exclude" ? "($|/)" : "$"}`;
