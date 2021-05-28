---
title: dotenv / crossenv
---

## dotenv
1. install [`dotenv`](https://www.npmjs.com/package/dotenv) package
2. create `.env` file with you enviroment variables
3. add `-r dotenv/config` to your `package.json` scripts

```json
{
  "scripts": {
    "start": "node -r ts-node/register -r dotenv/config src/index.ts"
  }
}
```

## cross-env
1. install [`cross-env`](https://www.npmjs.com/package/cross-env) package
2. add `cross-env NODE_ENV=development` to your `package.json` scripts
```json
{
  "scripts": {
    "start": "cross-env NODE_ENV=production ts-node src/index.ts"
  }
}
```

or combine use **cross-env** with **dotenv**: 
```json
{
  "scripts": {
    "start-dev": "cross-env NODE_ENV=development node -r ts-node/register -r dotenv/config src/index.ts"
  }
}
```
