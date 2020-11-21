## How to create your own ts-node powered REPL

- Create ts-node REPL service which includes EvalState
- Create ts-node service using EvalState-aware `readFile` and `fileExists` implementations from REPL
- Pass service to repl service
- Either:
  - call REPL method start() to start a REPL
  - create your own node repl but pass it REPL service's eval() function


```
const tsNodeReplService = tsNode.createReplService()
const {readFile, fileExists} = repl.getStateAwareHostFunctions()
const service = tsNode.register({
    ... options,
    readFile,
    fileExists
})
tsNodeReplService.setService(service);
tsNodeReplService.start();

// or
const repl = require('repl').start({
    ... options,
    eval: tsNodeReplService.nodeReplEval
});
```
