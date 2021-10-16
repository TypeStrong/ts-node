import ts = require("typescript");
import { getPatternFromSpec } from "../src/ts-internals";

// Notes and demos to understand `ts.sys`

console.dir(ts.sys.getCurrentDirectory());
// Gets names (not paths) of all directories that are direct children of given path
// Never throws
// Accepts trailing `/` or not
console.dir(ts.sys.getDirectories(ts.sys.getCurrentDirectory()));

/////

// Returns array of absolute paths
// Never returns directories; only files

// Values can have period or not; are interpreted as a suffix ('o.svg' matches logo.svg; seems to also match if you embed / directory delimiters)
// [''] is the same as undefined; returns everything
const extensions: string[] | undefined = [''];
// Supports wildcards; ts-style globs?
const exclude: string[] | undefined = undefined;
const include: string[] | undefined = ['*/????????????'];
// Depth == 0 is the same as undefined: unlimited depth
// Depth == 1 is only direct children of directory
const depth: number | undefined = undefined;
console.dir(ts.sys.readDirectory(ts.sys.getCurrentDirectory(), extensions, exclude, include, depth));

// To overlay virtual filesystem contents over `ts.sys.readDirectory`, try this:
// start with array of all virtual files
// Filter by those having base directory prefix
// if extensions is array, do an `endsWith` filter
// if exclude is an array, use `getPatternFromSpec` and filter out anything that matches
// if include is an array, use `getPatternFromSpec` and filter out anything that does not match at least one
// if depth is non-zero, count the number of directory delimiters following the base directory prefix

console.log(getPatternFromSpec('foo/*/bar', ts.sys.getCurrentDirectory()));
