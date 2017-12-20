import { expect } from 'chai'
import { exec } from 'child_process'
import { join } from 'path'
import semver = require('semver')
import ts = require('typescript')
import proxyquire = require('proxyquire')
import { register, VERSION } from './index'

const testDir = join(__dirname, '../tests')
const EXEC_PATH = join(__dirname, '../dist/bin')
const BIN_EXEC = `node "${EXEC_PATH}" --project "${testDir}"`

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
        cwd: testDir
      }, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, world!\n')

        return done()
      })
    })

    it('should execute cli with absolute path', function (done) {
      exec(`${BIN_EXEC} "${join(testDir, 'hello-world')}"`, function (err, stdout) {
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

    it('should throw errors', function (done) {
      exec(`${BIN_EXEC} --type-check -e "import * as m from './tests/module';console.log(m.example(123))"`, function (err) {
        if (err === null) {
          return done('Command was expected to fail, but it succeeded.')
        }

        expect(err.message).to.match(new RegExp(
          // Node 0.10 can not override the `lineOffset` option.
          '\\[eval\\]\\.ts \\(1,59\\): Argument of type \'(?:number|123)\' ' +
          'is not assignable to parameter of type \'string\'\\. \\(2345\\)'
        ))

        return done()
      })
    })

    it('should be able to ignore errors', function (done) {
      exec(
        `${BIN_EXEC} --type-check --ignoreWarnings 2345 -e "import * as m from './tests/module';console.log(m.example(123))"`,
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
      exec(`${BIN_EXEC} --type-check tests/throw`, function (err) {
        if (err === null) {
          return done('Command was expected to fail, but it succeeded.')
        }

        expect(err.message).to.contain(`${join(__dirname, '../tests/throw.ts')}:3`)
        expect(err.message).to.contain(`Error: this is a demo`)

        return done()
      })
    })

    it.skip('eval should work with source maps', function (done) {
      exec(`${BIN_EXEC} --type-check -p "import './tests/throw'"`, function (err) {
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

    it('should use transpile mode by default', function (done) {
      exec(`${BIN_EXEC} -p "x"`, function (err) {
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
  })

  describe('register', function () {
    register({
      project: testDir,
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
})
