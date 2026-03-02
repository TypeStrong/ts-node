To run the experiment:

```
cd ./esm-usage-example # Must be in this directory
node -v # Must be using node v13

# Install the github branch via npm
npm install
node --loader ts-node/esm ./index.js

# Or if you're hacking locally
node --loader ../esm.mjs ./index

```
