The `dist-raw` directory contains JS sources that are distributed verbatim, not compiled nor typechecked via TS.

To implement ESM support, we unfortunately must duplicate some of node's built-in functionality that is not
exposed via an API.  We have copy-pasted the necessary code from https://github.com/nodejs/node/tree/master/lib
then modified it to suite our needs.

Formatting may be intentionally bad to keep the diff as small as possible, to make it easier to merge
upstream changes and understand our modifications.  For example, when we need to wrap node's source code
in a factory function, we will not indent the function body, to avoid whitespace changes in the diff.

One obvious problem with this approach: the code has been pulled from one version of node, whereas users of ts-node
run multiple versions of node.
Users running node 12 may see that ts-node behaves like node 14, for example.
