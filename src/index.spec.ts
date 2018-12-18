import { expect } from 'chai'
import { exec } from 'child_process'
import { join } from 'path'
import semver = require('semver')
import ts = require('typescript')
import proxyquire = require('proxyquire')
import { register, parseTransformers, VERSION } from './index'

const TEST_DIR = join(__dirname, '../tests')
const EXEC_PATH = join(__dirname, '../dist/bin')
const PROJECT = join(TEST_DIR, semver.gte(ts.version, '2.5.0') ? 'tsconfig.json5' : 'tsconfig.json')
const BIN_EXEC = `node "${EXEC_PATH}" --project "${PROJECT}"`

const SOURCE_MAP_REGEXP = /\/\/# sourceMappingURL=data:application\/json;charset=utf\-8;base64,[\w\+]+=*$/

describe('ts-node', function () {
  this.timeout(10000)

  it('should export the correct version', function () {
    expect(VERSION).to.equal(require('../package.json').version)
  })

  describe('cli', function () {
    this.slow(1000)

    it('should execute cli', function (done) {
      exec(`${BIN_EXEC} tests/hello-world`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, world!\n')

        return done()
      })
    })

    it('should register via cli', function (done) {
      exec(`node -r ../register hello-world.ts`, {
        cwd: TEST_DIR
      }, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, world!\n')

        return done()
      })
    })

    it('should execute cli with absolute path', function (done) {
      exec(`${BIN_EXEC} "${join(TEST_DIR, 'hello-world')}"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, world!\n')

        return done()
      })
    })

    it('should print scripts', function (done) {
      exec(`${BIN_EXEC} -p "import { example } from './tests/complex/index';example()"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('example\n')

        return done()
      })
    })

    if (semver.gte(ts.version, '1.8.0')) {
      it('should allow js', function (done) {
        exec(
          [
            BIN_EXEC,
            '-O "{\\\"allowJs\\\":true}"',
            '-p "import { main } from \'./tests/allow-js/run\';main()"'
          ].join(' '),
          function (err, stdout) {
            expect(err).to.equal(null)
            expect(stdout).to.equal('hello world\n')

            return done()
          }
        )
      })

      it('should include jsx when `allow-js` true', function (done) {
        exec(
          [
            BIN_EXEC,
            '-O "{\\\"allowJs\\\":true}"',
            '-p "import { Foo2 } from \'./tests/allow-js/with-jsx\'; Foo2.sayHi()"'
          ].join(' '),
          function (err, stdout) {
            expect(err).to.equal(null)
            expect(stdout).to.equal('hello world\n')

            return done()
          }
        )
      })
    }

    it('should eval code', function (done) {
      exec(
        `${BIN_EXEC} -e "import * as m from './tests/module';console.log(m.example('test'))"`,
        function (err, stdout) {
          expect(err).to.equal(null)
          expect(stdout).to.equal('TEST\n')

          return done()
        }
      )
    })

    it('should import empty files', function (done) {
      exec(`${BIN_EXEC} -e "import './tests/empty'"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('')

        return done()
      })
    })

    it('should throw errors', function (done) {
      exec(`${BIN_EXEC} -e "import * as m from './tests/module';console.log(m.example(123))"`, function (err) {
        if (err === null) {
          return done('Command was expected to fail, but it succeeded.')
        }

        expect(err.message).to.match(new RegExp(
          'TS2345: Argument of type \'(?:number|123)\' ' +
          'is not assignable to parameter of type \'string\'\\.'
        ))

        return done()
      })
    })

    it('should be able to ignore diagnostic', function (done) {
      exec(
        `${BIN_EXEC} --ignoreDiagnostics 2345 -e "import * as m from './tests/module';console.log(m.example(123))"`,
        function (err) {
          if (err === null) {
            return done('Command was expected to fail, but it succeeded.')
          }

          expect(err.message).to.match(
            /TypeError: (?:(?:undefined|foo\.toUpperCase) is not a function|.*has no method \'toUpperCase\')/
          )

          return done()
        }
      )
    })

    it('should work with source maps', function (done) {
      exec(`${BIN_EXEC} tests/throw`, function (err) {
        if (err === null) {
          return done('Command was expected to fail, but it succeeded.')
        }

        expect(err.message).to.contain([
          `${join(__dirname, '../tests/throw.ts')}:3`,
          '  bar () { throw new Error(\'this is a demo\') }',
          '                 ^',
          'Error: this is a demo'
        ].join('\n'))

        return done()
      })
    })

    it.skip('eval should work with source maps', function (done) {
      exec(`${BIN_EXEC} -p "import './tests/throw'"`, function (err) {
        if (err === null) {
          return done('Command was expected to fail, but it succeeded.')
        }

        expect(err.message).to.contain([
          `${join(__dirname, '../tests/throw.ts')}:3`,
          '  bar () { throw new Error(\'this is a demo\') }',
          '                 ^'
        ].join('\n'))

        return done()
      })
    })

    it('should support transpile only mode', function (done) {
      exec(`${BIN_EXEC} --transpileOnly -p "x"`, function (err) {
        if (err === null) {
          return done('Command was expected to fail, but it succeeded.')
        }

        expect(err.message).to.contain('ReferenceError: x is not defined')

        return done()
      })
    })

    it('should pipe into `ts-node` and evaluate', function (done) {
      const cp = exec(BIN_EXEC, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('hello\n')

        return done()
      })

      cp.stdin.end("console.log('hello')")
    })

    it('should pipe into `ts-node`', function (done) {
      const cp = exec(`${BIN_EXEC} -p`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('true\n')

        return done()
      })

      cp.stdin.end('true')
    })

    it('should pipe into an eval script', function (done) {
      const cp = exec(`${BIN_EXEC} --fast -p 'process.stdin.isTTY'`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('undefined\n')

        return done()
      })

      cp.stdin.end('true')
    })

    it('should support require flags', function (done) {
      exec(`${BIN_EXEC} -r ./tests/hello-world -p "console.log('success')"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, world!\nsuccess\nundefined\n')

        return done()
      })
    })

    it('should support require from node modules', function (done) {
      exec(`${BIN_EXEC} -r typescript -e "console.log('success')"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('success\n')

        return done()
      })
    })

    it.skip('should use source maps with react tsx', function (done) {
      exec(`${BIN_EXEC} -r ./tests/emit-compiled.ts tests/jsx-react.tsx`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('todo')

        return done()
      })
    })

    it('should allow custom typings', function (done) {
      exec(`${BIN_EXEC} tests/custom-types`, function (err, stdout) {
        expect(err).to.match(/Error: Cannot find module 'does-not-exist'/)

        return done()
      })
    })

    describe('should support custom transformers', function () {
      beforeEach(function () {
        if (semver.lt(ts.version, '2.3.0')) {
          this.skip()
        }
      })

      it('with out transformers', function (done) {
        const execBin = `node "${EXEC_PATH}" --project "${TEST_DIR}/tsconfig.json"`

        exec(`${execBin} tests/with-transformer`, function (err, stdout) {
          expect(err).to.equal(null)
          console.log(stdout)
          // expect(JSON.parse(stdout)).to.deep.equal({
          //   id: 10,
          //   name: 'username'
          // })
          return done()
        })
      })

      it('with transformers', function (done) {
        const execBin = `node "${EXEC_PATH}" --transformers "./tests/transformers/demo.js" --project "${TEST_DIR}/tsconfig.json"`

        exec(`${execBin} tests/with-transformer`, function (err, stdout) {
          expect(err).to.equal(null)
          console.log(stdout)
          // expect(JSON.parse(stdout)).to.deep.equal({
          //   id: 10,
          //   name: 'username',
          //   interfaceData: {
          //     id: 'number',
          //     name: 'string'
          //   }
          // })
          return done()
        })
      })

      it('with Environment', function (done) {
        const execBin = `export TS_NODE_TRANSFORMERS="./tests/transformers/demo.js" && node "${EXEC_PATH}" --project "${TEST_DIR}/tsconfig.json"`

        exec(`${execBin} tests/with-transformer`, function (err, stdout) {
          expect(err).to.equal(null)
          console.log(stdout)
          // expect(JSON.parse(stdout)).to.deep.equal({
          //   id: 10,
          //   name: 'username',
          //   interfaceData: {
          //     id: 'number',
          //     name: 'string'
          //   }
          // })
          return done()
        })
      })

      it('multi transformers', function (done) {
        const execBin = `node "${EXEC_PATH}" --transformers "./tests/transformers/demo.js" --transformers "./tests/transformers/simple.js" --project "${TEST_DIR}/tsconfig.json"`

        exec(`${execBin} tests/with-transformer`, function (err, stdout) {
          expect(err).to.equal(null)
          console.log(stdout)
          // expect(JSON.parse(stdout)).to.deep.equal({
          //   a: 1000,
          //   id: 10,
          //   name: 'username',
          //   interfaceData: {
          //     id: 'number',
          //     name: 'string'
          //   }
          // })
          return done()
        })
      })

      it('multi transformers with Environment', function (done) {
        const execBin = `export TS_NODE_TRANSFORMERS="./tests/transformers/demo.js, ./tests/transformers/simple.js" && node "${EXEC_PATH}" --project "${TEST_DIR}/tsconfig.json"`

        exec(`${execBin} tests/with-transformer`, function (err, stdout) {
          expect(err).to.equal(null)
          console.log(stdout)
          // expect(JSON.parse(stdout)).to.deep.equal({
          //   a: 1000,
          //   id: 10,
          //   name: 'username',
          //   interfaceData: {
          //     id: 'number',
          //     name: 'string'
          //   }
          // })
          return done()
        })
      })
    })
  })

  describe('register', function () {
    register({
      project: PROJECT,
      compilerOptions: {
        jsx: 'preserve'
      }
    })

    it('should be able to require typescript', function () {
      const m = require('../tests/module')

      expect(m.example('foo')).to.equal('FOO')
    })

    it('should compile through js and ts', function () {
      const m = require('../tests/complex')

      expect(m.example()).to.equal('example')
    })

    it('should work with proxyquire', function () {
      const m = proxyquire('../tests/complex', {
        './example': 'hello'
      })

      expect(m.example()).to.equal('hello')
    })

    it('should use source maps', function (done) {
      try {
        require('../tests/throw')
      } catch (error) {
        expect(error.stack).to.contain([
          'Error: this is a demo',
          `    at Foo.bar (${join(__dirname, '../tests/throw.ts')}:3:18)`
        ].join('\n'))

        done()
      }
    })

    describe('JSX preserve', () => {
      let old = require.extensions['.tsx']
      let compiled: string

      before(function () {
        require.extensions['.tsx'] = (m: any, fileName) => {
          const _compile = m._compile

          m._compile = (code: string, fileName: string) => {
            compiled = code
            return _compile.call(this, code, fileName)
          }

          return old(m, fileName)
        }
      })

      after(function () {
        require.extensions['.tsx'] = old
      })

      it('should use source maps', function (done) {
        try {
          require('../tests/with-jsx.tsx')
        } catch (error) {
          expect(error.stack).to.contain('SyntaxError: Unexpected token <\n')
        }

        expect(compiled).to.match(SOURCE_MAP_REGEXP)

        done()
      })
    })
  })

  describe('parseTransformers', () => {
    it('should merge multi transformers', function (done) {
      const result = parseTransformers(['./tests/transformers/demo.js', './tests/transformers/after.js'], TEST_DIR)

      if (result.before) { expect(result.before.length).to.eql(2) }
      if (result.after) { expect(result.after.length).to.eql(1) }
      if (result.afterDeclarations) { expect(result.afterDeclarations.length).to.eql(1) }

      done()
    })
  })

})
