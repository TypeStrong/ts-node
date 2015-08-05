import { expect } from 'chai'
import { exec } from 'child_process'
import { join } from 'path'
import { register, VERSION } from './typescript-node'

const BIN_PATH = join(__dirname, '../dist/bin/ts-node')

const compiler = register()

describe('ts-node', function () {
  this.timeout(5000)

  it('should export the correct version', function () {
    expect(VERSION).to.equal(require('../package.json').version)
  })

  it('should execute cli', function (done) {
    exec(`node ${BIN_PATH} tests/hello-world`, function (err, stdout) {
      expect(err).to.not.exist
      expect(stdout).to.equal('Hello, world!\n')

      return done()
    })
  })

  it('should print scripts', function (done) {
    exec(`node ${BIN_PATH} -p "import { example } from './tests/complex/index';example()"`, function (err, stdout) {
      expect(err).to.not.exist
      expect(stdout).to.equal('example\n')

      return done()
    })
  })

  it('should eval code', function (done) {
    exec(`node ${BIN_PATH} -e "import * as m from './tests/module';console.log(m.example('test'))"`, function (err, stdout) {
      expect(err).to.not.exist
      expect(stdout).to.equal('TEST\n')

      return done()
    })
  })

  it('should throw errors', function (done) {
    exec(`node ${BIN_PATH} -e "import * as m from './tests/module';console.log(m.example(123))"`, function (err) {
      expect(err.message).to.contain('[eval].ts (1,59): Argument of type \'number\' is not assignable to parameter of type \'string\'. (2345)')

      return done()
    })
  })

  it('should be able to ignore errors', function (done) {
    exec(`node ${BIN_PATH} --ignoreWarnings 2345 -e "import * as m from './tests/module';console.log(m.example(123))"`, function (err) {
      expect(err.message).to.match(/TypeError: (?:(?:undefined|foo\.toUpperCase) is not a function|.*has no method \'toUpperCase\')/)

      return done()
    })
  })

  it('should work with source maps', function (done) {
    exec(`node ${BIN_PATH} tests/throw`, function (err) {
      expect(err.message).to.contain([
        `${join(__dirname, '../tests/throw.ts')}:3`,
        '  bar () { throw new Error(\'this is a demo\') }',
        '                 ^',
        'Error: this is a demo'
      ].join('\n'))

      return done()
    })
  })

  it('eval should work with source maps', function (done) {
    exec(`node ${BIN_PATH} -p "import './tests/throw'"`, function (err) {
      expect(err.message).to.contain([
        `${join(__dirname, '../tests/throw.ts')}:3`,
        '  bar () { throw new Error(\'this is a demo\') }',
        '                 ^',
        'Error: this is a demo'
      ].join('\n'))

      return done()
    })
  })

  it('should be able to require typescript', function () {
    var m = require('../tests/module')

    expect(m.example('foo')).to.equal('FOO')
  })

  it('should compile through js and ts', function () {
    var m = require('../tests/complex')

    expect(m.example()).to.equal('example')
  })
})
