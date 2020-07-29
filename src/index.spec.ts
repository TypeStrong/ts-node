import { expect } from 'chai'
import { exec } from 'child_process'
import { join } from 'path'
import semver = require('semver')
import ts = require('typescript')
import proxyquire = require('proxyquire')
import type * as tsNodeTypes from './index'
import { unlinkSync, existsSync, lstatSync } from 'fs'
import * as promisify from 'util.promisify'
import { sync as rimrafSync } from 'rimraf'
import { createRequire, createRequireFromPath } from 'module'
import { pathToFileURL } from 'url'
import Module = require('module')

const execP = promisify(exec)

const TEST_DIR = join(__dirname, '../tests')
const PROJECT = join(TEST_DIR, 'tsconfig.json')
const BIN_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node')
const BIN_SCRIPT_PATH = join(TEST_DIR, 'node_modules/.bin/ts-node-script')

const SOURCE_MAP_REGEXP = /\/\/# sourceMappingURL=data:application\/json;charset=utf\-8;base64,[\w\+]+=*$/

// `createRequire` does not exist on older node versions
const testsDirRequire = (createRequire || createRequireFromPath)(join(TEST_DIR, 'index.js')) // tslint:disable-line

// Set after ts-node is installed locally
let { register, create, VERSION }: typeof tsNodeTypes = {} as any

// Pack and install ts-node locally, necessary to test package "exports"
before(async function () {
  this.timeout(5 * 60e3)
  rimrafSync(join(TEST_DIR, 'node_modules'))
  await execP(`npm install`, { cwd: TEST_DIR })
  const packageLockPath = join(TEST_DIR, 'package-lock.json')
  existsSync(packageLockPath) && unlinkSync(packageLockPath)
  ;({ register, create, VERSION } = testsDirRequire('ts-node'))
})

describe('ts-node', function () {
  const cmd = `"${BIN_PATH}" --project "${PROJECT}"`

  this.timeout(10000)

  it('should export the correct version', function () {
    expect(VERSION).to.equal(require('../package.json').version)
  })
  it('should export all CJS entrypoints', function () {
    // Ensure our package.json "exports" declaration allows `require()`ing all our entrypoints
    // https://github.com/TypeStrong/ts-node/pull/1026

    testsDirRequire.resolve('ts-node')

    // only reliably way to ask node for the root path of a dependency is Path.resolve(require.resolve('ts-node/package'), '..')
    testsDirRequire.resolve('ts-node/package')
    testsDirRequire.resolve('ts-node/package.json')

    // All bin entrypoints for people who need to augment our CLI: `node -r otherstuff ./node_modules/ts-node/dist/bin`
    testsDirRequire.resolve('ts-node/dist/bin')
    testsDirRequire.resolve('ts-node/dist/bin.js')
    testsDirRequire.resolve('ts-node/dist/bin-transpile')
    testsDirRequire.resolve('ts-node/dist/bin-transpile.js')
    testsDirRequire.resolve('ts-node/dist/bin-script')
    testsDirRequire.resolve('ts-node/dist/bin-script.js')

    // Must be `require()`able obviously
    testsDirRequire.resolve('ts-node/register')
    testsDirRequire.resolve('ts-node/register/files')
    testsDirRequire.resolve('ts-node/register/transpile-only')
    testsDirRequire.resolve('ts-node/register/type-check')

    // `node --loader ts-node/esm`
    testsDirRequire.resolve('ts-node/esm')
    testsDirRequire.resolve('ts-node/esm.mjs')
  })

  describe('cli', function () {
    this.slow(1000)

    it('should execute cli', function (done) {
      exec(`${cmd} tests/hello-world`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, world!\n')

        return done()
      })
    })

    it('should register via cli', function (done) {
      exec(`node -r ts-node/register hello-world.ts`, {
        cwd: TEST_DIR
      }, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, world!\n')

        return done()
      })
    })

    it('should execute cli with absolute path', function (done) {
      exec(`${cmd} "${join(TEST_DIR, 'hello-world')}"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, world!\n')

        return done()
      })
    })

    it('should print scripts', function (done) {
      exec(`${cmd} -pe "import { example } from './tests/complex/index';example()"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('example\n')

        return done()
      })
    })

    it('should provide registered information globally', function (done) {
      exec(`${cmd} tests/env`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('object\n')

        return done()
      })
    })

    it('should provide registered information on register', function (done) {
      exec(`node -r ts-node/register env.ts`, {
        cwd: TEST_DIR
      }, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('object\n')

        return done()
      })
    })

    if (semver.gte(ts.version, '1.8.0')) {
      it('should allow js', function (done) {
        exec(
          [
            cmd,
            '-O "{\\\"allowJs\\\":true}"',
            '-pe "import { main } from \'./tests/allow-js/run\';main()"'
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
            cmd,
            '-O "{\\\"allowJs\\\":true}"',
            '-pe "import { Foo2 } from \'./tests/allow-js/with-jsx\'; Foo2.sayHi()"'
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
        `${cmd} -e "import * as m from './tests/module';console.log(m.example('test'))"`,
        function (err, stdout) {
          expect(err).to.equal(null)
          expect(stdout).to.equal('TEST\n')

          return done()
        }
      )
    })

    it('should import empty files', function (done) {
      exec(`${cmd} -e "import './tests/empty'"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('')

        return done()
      })
    })

    it('should throw errors', function (done) {
      exec(`${cmd} -e "import * as m from './tests/module';console.log(m.example(123))"`, function (err) {
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
        `${cmd} --ignore-diagnostics 2345 -e "import * as m from './tests/module';console.log(m.example(123))"`,
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
      exec(`${cmd} tests/throw`, function (err) {
        if (err === null) {
          return done('Command was expected to fail, but it succeeded.')
        }

        expect(err.message).to.contain([
          `${join(__dirname, '../tests/throw.ts')}:100`,
          '  bar () { throw new Error(\'this is a demo\') }',
          '                 ^',
          'Error: this is a demo'
        ].join('\n'))

        return done()
      })
    })

    it('eval should work with source maps', function (done) {
      exec(`${cmd} -pe "import './tests/throw'"`, function (err) {
        if (err === null) {
          return done('Command was expected to fail, but it succeeded.')
        }

        expect(err.message).to.contain([
          `${join(__dirname, '../tests/throw.ts')}:100`,
          '  bar () { throw new Error(\'this is a demo\') }',
          '                 ^'
        ].join('\n'))

        return done()
      })
    })

    it('should support transpile only mode', function (done) {
      exec(`${cmd} --transpile-only -pe "x"`, function (err) {
        if (err === null) {
          return done('Command was expected to fail, but it succeeded.')
        }

        expect(err.message).to.contain('ReferenceError: x is not defined')

        return done()
      })
    })

    it('should throw error even in transpileOnly mode', function (done) {
      exec(`${cmd} --transpile-only -pe "console."`, function (err) {
        if (err === null) {
          return done('Command was expected to fail, but it succeeded.')
        }

        expect(err.message).to.contain('error TS1003: Identifier expected')

        return done()
      })
    })

    it('should pipe into `ts-node` and evaluate', function (done) {
      const cp = exec(cmd, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('hello\n')

        return done()
      })

      cp.stdin!.end("console.log('hello')")
    })

    it('should pipe into `ts-node`', function (done) {
      const cp = exec(`${cmd} -p`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('true\n')

        return done()
      })

      cp.stdin!.end('true')
    })

    it('should pipe into an eval script', function (done) {
      const cp = exec(`${cmd} --transpile-only -pe "process.stdin.isTTY"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('undefined\n')

        return done()
      })

      cp.stdin!.end('true')
    })

    it('should run REPL when --interactive passed and stdin is not a TTY', function (done) {
      const cp = exec(`${cmd} --interactive`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal(
          '> 123\n' +
          'undefined\n' +
          '> '
        )
        return done()
      })

      cp.stdin!.end('console.log("123")\n')

    })

    it('should support require flags', function (done) {
      exec(`${cmd} -r ./tests/hello-world -pe "console.log('success')"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, world!\nsuccess\nundefined\n')

        return done()
      })
    })

    it('should support require from node modules', function (done) {
      exec(`${cmd} -r typescript -e "console.log('success')"`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('success\n')

        return done()
      })
    })

    it.skip('should use source maps with react tsx', function (done) {
      exec(`${cmd} -r ./tests/emit-compiled.ts tests/jsx-react.tsx`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('todo')

        return done()
      })
    })

    it('should allow custom typings', function (done) {
      exec(`${cmd} tests/custom-types`, function (err, stdout) {
        expect(err).to.match(/Error: Cannot find module 'does-not-exist'/)

        return done()
      })
    })

    it('should preserve `ts-node` context with child process', function (done) {
      exec(`${cmd} tests/child-process`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, world!\n')

        return done()
      })
    })

    it('should import js before ts by default', function (done) {
      exec(`${cmd} tests/import-order/compiled`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, JavaScript!\n')

        return done()
      })
    })

    it('should import ts before js when --prefer-ts-exts flag is present', function (done) {
      exec(`${cmd} --prefer-ts-exts tests/import-order/compiled`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, TypeScript!\n')

        return done()
      })
    })

    it('should import ts before js when TS_NODE_PREFER_TS_EXTS env is present', function (done) {
      exec(`${cmd} tests/import-order/compiled`, { env: { ...process.env, TS_NODE_PREFER_TS_EXTS: 'true' } }, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, TypeScript!\n')

        return done()
      })
    })

    it('should ignore .d.ts files', function (done) {
      exec(`${cmd} tests/import-order/importer`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('Hello, World!\n')

        return done()
      })
    })

    describe('issue #884', function () {
      it('should compile', function (done) {
        // TODO disabled because it consistently fails on Windows on TS 2.7
        if (process.platform === 'win32' && semver.satisfies(ts.version, '2.7')) {
          this.skip()
        } else {
          exec(`"${BIN_PATH}" --project tests/issue-884/tsconfig.json tests/issue-884`, function (err, stdout) {
            expect(err).to.equal(null)
            expect(stdout).to.equal('')

            return done()
          })
        }
      })
    })

    describe('issue #986', function () {
      it('should not compile', function (done) {
        exec(`"${BIN_PATH}" --project tests/issue-986/tsconfig.json tests/issue-986`, function (err, stdout, stderr) {
          expect(err).not.to.equal(null)
          expect(stderr).to.contain('Cannot find name \'TEST\'') // TypeScript error.
          expect(stdout).to.equal('')

          return done()
        })
      })

      it('should compile with `--files`', function (done) {
        exec(`"${BIN_PATH}" --files --project tests/issue-986/tsconfig.json tests/issue-986`, function (err, stdout, stderr) {
          expect(err).not.to.equal(null)
          expect(stderr).to.contain('ReferenceError: TEST is not defined') // Runtime error.
          expect(stdout).to.equal('')

          return done()
        })
      })
    })

    if (semver.gte(ts.version, '2.7.0')) {
      it('should support script mode', function (done) {
        exec(`${BIN_SCRIPT_PATH} tests/scope/a/log`, function (err, stdout) {
          expect(err).to.equal(null)
          expect(stdout).to.equal('.ts\n')

          return done()
        })
      })
      it('should read tsconfig relative to realpath, not symlink, in scriptMode', function (done) {
        if (lstatSync(join(TEST_DIR, 'main-realpath/symlink/symlink.tsx')).isSymbolicLink()) {
          exec(`${BIN_SCRIPT_PATH} tests/main-realpath/symlink/symlink.tsx`, function (err, stdout) {
            expect(err).to.equal(null)
            expect(stdout).to.equal('')

            return done()
          })
        } else {
          this.skip()
        }
      })
    }

    describe('should read ts-node options from tsconfig.json', function () {
      const BIN_EXEC = `"${BIN_PATH}" --project tests/tsconfig-options/tsconfig.json`

      it('should override compiler options from env', function (done) {
        exec(`${BIN_EXEC} tests/tsconfig-options/log-options.js`, {
          env: {
            ...process.env,
            TS_NODE_COMPILER_OPTIONS: '{"typeRoots": ["env-typeroots"]}'
          }
        }, function (err, stdout) {
          expect(err).to.equal(null)
          const { config } = JSON.parse(stdout)
          expect(config.options.typeRoots).to.deep.equal([join(__dirname, '../tests/tsconfig-options/env-typeroots').replace(/\\/g, '/')])
          return done()
        })
      })

      it('should use options from `tsconfig.json`', function (done) {
        exec(`${BIN_EXEC} tests/tsconfig-options/log-options.js`, function (err, stdout) {
          expect(err).to.equal(null)
          const { options, config } = JSON.parse(stdout)
          expect(config.options.typeRoots).to.deep.equal([join(__dirname, '../tests/tsconfig-options/tsconfig-typeroots').replace(/\\/g, '/')])
          expect(config.options.types).to.deep.equal(['tsconfig-tsnode-types'])
          expect(options.pretty).to.equal(undefined)
          expect(options.skipIgnore).to.equal(false)
          expect(options.transpileOnly).to.equal(true)
          return done()
        })
      })

      it('should have flags override `tsconfig.json`', function (done) {
        exec(`${BIN_EXEC} --skip-ignore --compiler-options "{\\"types\\":[\\"flags-types\\"]}" tests/tsconfig-options/log-options.js`, function (err, stdout) {
          expect(err).to.equal(null)
          const { options, config } = JSON.parse(stdout)
          expect(config.options.typeRoots).to.deep.equal([join(__dirname, '../tests/tsconfig-options/tsconfig-typeroots').replace(/\\/g, '/')])
          expect(config.options.types).to.deep.equal(['flags-types'])
          expect(options.pretty).to.equal(undefined)
          expect(options.skipIgnore).to.equal(true)
          expect(options.transpileOnly).to.equal(true)
          return done()
        })
      })

      it('should have `tsconfig.json` override environment', function (done) {
        exec(`${BIN_EXEC} tests/tsconfig-options/log-options.js`, {
          env: {
            ...process.env,
            TS_NODE_PRETTY: 'true',
            TS_NODE_SKIP_IGNORE: 'true'
          }
        }, function (err, stdout) {
          expect(err).to.equal(null)
          const { options, config } = JSON.parse(stdout)
          expect(config.options.typeRoots).to.deep.equal([join(__dirname, '../tests/tsconfig-options/tsconfig-typeroots').replace(/\\/g, '/')])
          expect(config.options.types).to.deep.equal(['tsconfig-tsnode-types'])
          expect(options.pretty).to.equal(true)
          expect(options.skipIgnore).to.equal(false)
          expect(options.transpileOnly).to.equal(true)
          return done()
        })
      })
    })

    describe('compiler host', function () {
      it('should execute cli', function (done) {
        exec(`${cmd} --compiler-host tests/hello-world`, function (err, stdout) {
          expect(err).to.equal(null)
          expect(stdout).to.equal('Hello, world!\n')

          return done()
        })
      })

      it('should give ts error for invalid node_modules', function (done) {
        exec(`${cmd} --compiler-host --skip-ignore tests/from-node-modules/from-node-modules`, function (err, stdout) {
          if (err === null) return done('Expected an error')

          expect(err.message).to.contain('Unable to compile file from external library')

          return done()
        })
      })
    })

    it('should transpile files inside a node_modules directory when not ignored', function (done) {
      exec(`${cmd} --skip-ignore tests/from-node-modules/from-node-modules`, function (err, stdout, stderr) {
        if (err) return done(`Unexpected error: ${err}\nstdout:\n${stdout}\nstderr:\n${stderr}`)
        done()
      })
    })
  })

  describe('register', function () {
    let registered: tsNodeTypes.Register
    before(() => {
      registered = register({
        project: PROJECT,
        compilerOptions: {
          jsx: 'preserve'
        }
      })
    })

    const moduleTestPath = require.resolve('../tests/module')

    afterEach(() => {
      // Re-enable project after every test.
      registered.enabled(true)
    })

    it('should be able to require typescript', function () {
      const m = require(moduleTestPath)

      expect(m.example('foo')).to.equal('FOO')
    })

    it('should support dynamically disabling', function () {
      delete require.cache[moduleTestPath]

      expect(registered.enabled(false)).to.equal(false)
      expect(() => require(moduleTestPath)).to.throw(/Unexpected token/)

      delete require.cache[moduleTestPath]

      expect(registered.enabled()).to.equal(false)
      expect(() => require(moduleTestPath)).to.throw(/Unexpected token/)

      delete require.cache[moduleTestPath]

      expect(registered.enabled(true)).to.equal(true)
      expect(() => require(moduleTestPath)).to.not.throw()

      delete require.cache[moduleTestPath]

      expect(registered.enabled()).to.equal(true)
      expect(() => require(moduleTestPath)).to.not.throw()
    })

    if (semver.gte(ts.version, '2.7.0')) {
      it('should support compiler scopes', function () {
        const calls: string[] = []

        registered.enabled(false)

        const compilers = [
          register({ dir: join(TEST_DIR, 'scope/a'), scope: true }),
          register({ dir: join(TEST_DIR, 'scope/b'), scope: true })
        ]

        compilers.forEach(c => {
          const old = c.compile
          c.compile = (code, fileName, lineOffset) => {
            calls.push(fileName)

            return old(code, fileName, lineOffset)
          }
        })

        try {
          expect(require('../tests/scope/a').ext).to.equal('.ts')
          expect(require('../tests/scope/b').ext).to.equal('.ts')
        } finally {
          compilers.forEach(c => c.enabled(false))
        }

        expect(calls).to.deep.equal([
          join(TEST_DIR, 'scope/a/index.ts'),
          join(TEST_DIR, 'scope/b/index.ts')
        ])

        delete require.cache[moduleTestPath]

        expect(() => require(moduleTestPath)).to.throw()
      })
    }

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

    it('should work with `require.cache`', function () {
      const { example1, example2 } = require('../tests/require-cache')

      expect(example1).to.not.equal(example2)
    })

    it('should use source maps', function (done) {
      try {
        require('../tests/throw')
      } catch (error) {
        expect(error.stack).to.contain([
          'Error: this is a demo',
          `    at Foo.bar (${join(__dirname, '../tests/throw.ts')}:100:18)`
        ].join('\n'))

        done()
      }
    })

    describe('JSX preserve', () => {
      let old: (m: Module, filename: string) => any
      let compiled: string

      before(function () {
        old = require.extensions['.tsx']! // tslint:disable-line
        require.extensions['.tsx'] = (m: any, fileName) => { // tslint:disable-line
          const _compile = m._compile

          m._compile = (code: string, fileName: string) => {
            compiled = code
            return _compile.call(this, code, fileName)
          }

          return old(m, fileName)
        }
      })

      after(function () {
        require.extensions['.tsx'] = old // tslint:disable-line
      })

      it('should use source maps', function (done) {
        try {
          require('../tests/with-jsx.tsx')
        } catch (error) {
          expect(error.stack).to.contain('SyntaxError: Unexpected token')
        }

        expect(compiled).to.match(SOURCE_MAP_REGEXP)

        done()
      })
    })
  })

  describe('create', () => {
    it('should create generic compiler instances', () => {
      const service = create({ compilerOptions: { target: 'es5' }, skipProject: true })
      const output = service.compile('const x = 10', 'test.ts')

      expect(output).to.contain('var x = 10;')
    })
  })

  describe('esm', () => {
    this.slow(1000)

    const cmd = `node --loader ts-node/esm`

    if (semver.gte(process.version, '13.0.0')) {
      it('should compile and execute as ESM', (done) => {
        exec(`${cmd} index.ts`, { cwd: join(__dirname, '../tests/esm') }, function (err, stdout) {
          expect(err).to.equal(null)
          expect(stdout).to.equal('foo bar baz biff\n')

          return done()
        })
      })
      it('should use source maps', function (done) {
        exec(`${cmd} throw.ts`, { cwd: join(__dirname, '../tests/esm') }, function (err, stdout) {
          expect(err).not.to.equal(null)
          expect(err!.message).to.contain([
            `${pathToFileURL(join(__dirname, '../tests/esm/throw.ts'))}:100`,
            '  bar () { throw new Error(\'this is a demo\') }',
            '                 ^',
            'Error: this is a demo'
          ].join('\n'))

          return done()
        })
      })
      it('supports --experimental-specifier-resolution=node', (done) => {
        exec(`${cmd} --experimental-specifier-resolution=node index.ts`, { cwd: join(__dirname, '../tests/esm-node-resolver') }, function (err, stdout) {
          expect(err).to.equal(null)
          expect(stdout).to.equal('foo bar baz biff\n')

          return done()
        })

      })
      it('throws ERR_REQUIRE_ESM when attempting to require() an ESM script while ESM loader is enabled', function (done) {
        exec(`${cmd} ./index.js`, { cwd: join(__dirname, '../tests/esm-err-require-esm') }, function (err, stdout, stderr) {
          expect(err).to.not.equal(null)
          expect(stderr).to.contain('Error [ERR_REQUIRE_ESM]: Must use import to load ES Module:')

          return done()
        })
      })
    }

    it('executes ESM as CJS, ignoring package.json "types" field (for backwards compatibility; should be changed in next major release to throw ERR_REQUIRE_ESM)', function (done) {
      exec(`${BIN_PATH} ./tests/esm-err-require-esm/index.js`, function (err, stdout) {
        expect(err).to.equal(null)
        expect(stdout).to.equal('CommonJS\n')

        return done()
      })
    })
  })
})
