## Yarn PnP interop

Asked about it here:
https://discord.com/channels/226791405589233664/654372321225605128/957301175609344070

PnP API checks if import specifiers are for dependencies: non-relative, non-absolute
  libfoo
  @scope/libfoo

When they are, it does `resolveToUnqualified` to map to an unqualified path.
This path points to the module's location on disk (in a zip, perhaps) but does
not handle file extension resolution or stuff like that.

To interop with PnP, we need PnP to *only* `resolveToUnqualified`.
We do everything else.

```typescript
import { Module } from 'module';
import fs from 'fs';

const pathRegExp = /^(?![a-zA-Z]:[\\/]|\\\\|\.{0,2}(?:\/|$))((?:@[^/]+\/)?[^/]+)\/*(.*|)$/;

const originalModuleResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (
    request: string,
    parent: typeof Module | null | undefined,
    isMain: boolean,
    options?: { [key: string]: any }
) {
    const dependencyNameMatch = request.match(pathRegExp);
    if (dependencyNameMatch !== null) {

      const [, dependencyName, subPath] = dependencyNameMatch;

      const unqualified = pnpapi.resolveToUnqualified(....);

      // Do your modified resolution on the unqualified path here

    } else {

      // Do your modified resolution here; no need for PnP

    }

};
```

PnP can be installed at runtime.

To conditionally check if PnP is available at the start of *every* resolution:

```typescript
// Get the pnpapi of either the issuer or the specifier.
// The latter is required when the specifier is an absolute path to a
// zip file and the issuer doesn't belong to a pnpapi
const {findPnPApi} = Module;
const pnpapi = findPnPApi ? (findPnpApi(issuer) ?? (url ? findPnpApi(specifier) : null)) : null;
if (pnpapi) {...}
```
