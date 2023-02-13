## Test guidelines

*These notes are my attempt at keeping myself consistent when writing tests. Nothing too formal.*

### DRYing up tests with reusable functions

If a reusable function does not need access to anything from the context,
it's a plain function.

If the reusable function needs access to stuff from context, it's a
context helper.

If the reusable function implements all the necessary assertions within itself, it's a macro.

### Function args

Plain functions w/many options should accept a single option-bag.  
Should also have `setOptions` method to overlay additional options, and `getOptions` to inspect.
*At time of writing, I have not implemented `setOptions` nor `getOptions`*

Never destructure `t`
Never destructure `test`
Only exception: destructure `{context}` or `{contextEach}` if calling `const test = context(fooCtx)` b/c avoids `test = _test.context()`

### Consistent naming

When exec-ing a process:

Awaited result is in local var `r`  
Non-awaited is in local var `p`  
Do not destructure either way.

Context builders are named with a `ctx` prefix and also declare a couple types on their namespace.  See src/test/helpers/ctx* for format.
