## How we override isExternalLibraryImport

`isExternalLibraryImport` is a boolean returned by node's module resolver that is `true`
if the target module is inside a `node_modules` directory.

This has 2x effects inside the compiler:
a) compiler refuses to emit JS for external modules
b) increments node_module depth +1, which affects `maxNodeModulesJsDepth`

If someone `require()`s a file inside `node_modules`, we need to override this flag to overcome (a).

### ts-node's behavior

- If TS's normal resolution deems a file is external, we might override this flag.
  - Is file's containing module directory marked as "must be internal"?
    - if yes, override as "internal"
    - if no, track this flag, and leave it as "external"

When you try to `require()` a file that's previously been deemed "external", we mark the entire module's
directory as "must be internal" and add the file to `rootFiles` to trigger a re-resolve.

When you try to `require()` a file that's totally unknown to the compiler, we have to add it to `rootFiles`
to trigger a recompile.  This is a separate issue.

### Implementation notes

In `updateMemoryCache`:
- If file is not in rootFiles and is not known internal (either was never resolved or was resolved external)
  - mark module directory as "must be internal"
  - add file to rootFiles to either pull file into compilation or trigger re-resolve (will do both)

TODO: WHAT IF WE MUST MARK FILEA INTERNAL; WILL FILEB AUTOMATICALLY GET THE SAME TREATMENT?

TODO if `noResolve`, force adding to `rootFileNames`?

TODO if `noResolve` are the resolvers called anyway?

TODO eagerly classify .ts as internal, only use the "bucket" behavior for .js?
- b/c externalModule and maxNodeModulesJsDepth only seems to affect typechecking of .js, not .ts

### Tests

require() .ts file where TS didn't know about it before
require() .js file where TS didn't know about it before, w/allowJs
import {} ./node_modules/*/.ts
import {} ./node_modules/*/.js w/allowJs (initially external; will be switched to internal)
import {} ./node_modules/*/.ts from another file within node_modules
import {} ./node_modules/*/.js from another file within node_modules
require() from ./node_modules when it is ignored; ensure is not forced internal and maxNodeModulesJsDepth is respected (type info does not change)

### Keywords for searching TypeScript's source code

These may jog my memory the next time I need to read TypeScript's source and remember how this works.

currentNodeModulesDepth
sourceFilesFoundSearchingNodeModules

isExternalLibraryImport is used to increment currentNodeModulesDepth
currentNodeModulesDepth is used to put things into sourceFilesFoundSearchingNodeModules

https://github.com/microsoft/TypeScript/blob/ec338146166935069124572135119b57a3d2cd22/src/compiler/program.ts#L2384-L2398

getSourceFilesToEmit / sourceFileMayBeEmitted obeys internal "external" state, is responsible for preventing emit of external modules
