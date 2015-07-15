import { expect } from 'chai'
import { exec } from 'child_process'
import { join } from 'path'
import { register } from './typescript-node'

const BIN_PATH = join(__dirname, '../dist/bin/ts-node')

const compiler = register()

describe('ts-node', function () {
  it('should execute cli', function (done) {
    exec(`node ${BIN_PATH} ${join(__dirname, '../tests/hello-world')}`, function (err, stdout) {
      expect(err).to.not.exist
      expect(stdout).to.equal('Hello, world!\n')

      return done()
    })
  })

  it('should be able to require typescript', function () {
    var m = require('../tests/module')

    expect(m.example()).to.be.true
  })
})
