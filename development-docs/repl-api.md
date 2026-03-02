## How to create your own ts-node powered REPL

- Create ts-node REPL service which includes EvalState
- Create ts-node compiler service using EvalState-aware `readFile` and `fileExists` implementations from REPL
- Bind REPL service to compiler service (chicken-and-egg problem necessitates late binding)
- Either:
  - call REPL method start() to start a REPL
  - create your own node repl but pass it REPL service's nodeEval() function

```
import * as tsnode from 'ts-node';
const repl = tsnode.createRepl();
const service = tsnode.register({
    ... options,
    ...repl.evalAwarePartialHost
});
repl.setService(service);

// Start it
repl.start();

// or
const nodeRepl = require('repl').start({
    ...options,
    eval: repl.nodeEval
});
```
