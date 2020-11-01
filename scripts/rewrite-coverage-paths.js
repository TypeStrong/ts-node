const {readdirSync, readFileSync, writeFileSync, statSync} = require('fs')
const {resolve, sep} = require('path')
const {mapKeys, each} = require('lodash')

const fromPrefix = resolve(__dirname, '../tests/node_modules/ts-node') + sep
const toPrefix = resolve(__dirname, '..') + sep

function rewritePath(input) {
  if(input.indexOf(fromPrefix) === 0) {
    return toPrefix + input.slice(fromPrefix.length)
  }
  return input
}

const nycOutputDir = resolve(__dirname, '../.nyc_output')
for(const filename of readdirSync(nycOutputDir)) {
  const filePath = resolve(nycOutputDir, filename)
  if(statSync(filePath).isDirectory()) continue
  let json = JSON.parse(readFileSync(filePath, 'utf8'))
  json = mapKeys(json, (_, key) => rewritePath(key))
  each(json, obj => {
    if(obj.path)
      obj.path = rewritePath(obj.path)
  })
  writeFileSync(filePath, JSON.stringify(json))
}
