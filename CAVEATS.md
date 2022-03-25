CAVEATS

Node does not have require.extensions for mjs nor cjs
Thus they must be require()d including the extension.
Today, `ts-node` relies in extension omission to support CJS compilation.

How do we support .cts and .mts?
Allow someone to import .cts / .mts directly?
Wait for our resolver hook to be implemented?
Merge file extension resolving PR? (#1361)
