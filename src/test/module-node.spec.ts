import { _test, expect } from './testlib';
import { resetNodeEnvironment, ts } from './helpers';
import * as fs from 'fs';
import semver = require('semver');
import {
  CMD_TS_NODE_WITH_PROJECT_FLAG,
  contextTsNodeUnderTest,
  getStream,
  TEST_DIR,
} from './helpers';
import { createExec, createExecTester } from './exec-helpers';
import { promisify } from 'util';
import { createImportEqualsDeclaration } from 'typescript';

const test = _test.context(contextTsNodeUnderTest);
test.beforeEach(async t => {
  resetNodeEnvironment();
})

const packageJsonTypes = [undefined, 'commonjs', 'module'] as const;
const typecheckModes = ['typecheck', 'transpileOnly', 'swc'] as const;
const importStyles = ['static import', 'require', 'dynamic import', 'import = require'] as const;
const importExtension = ['js', 'ts', 'omitted'] as const;
const extensions = [
  {
    ext: 'cts',
    isCjs: true,
  }, {
    ext: 'cjs',
    isCjs: true,
    isJs: true,
  }, {
    ext: 'mts',
    isEsm: true,
  }, {
    ext: 'mjs',
    isEsm: true,
    isJs: true,
  }, {
    ext: 'ts',
  }, {
    ext: 'tsx',
    isJsx: true,
  }, {
    ext: 'jsx',
    isJsx: true,
    isJs: true,
  }, {
    ext: 'js'
  }
] as const;

interface TestParams {
  packageJsonType: typeof packageJsonTypes[number];
  typecheckMode: typeof typecheckModes[number];
  allowJs: boolean;
}

interface SubtestParams {
  importStyle: typeof importStyles[number],
  importerExtension: typeof extensions[number]
}

interface ImporteeParams {
  importeeExtension: typeof extensions[number]
}

for(const allowJs of [true, false]) {
  for(const typecheckMode of ['typecheck', 'transpileOnly', 'swc'] as const) {
    for(const packageJsonType of [undefined, 'commonjs', 'module'] as const) {
      createTest({allowJs, packageJsonType, typecheckMode});
    }
  }
}

function createTest(params: TestParams) {
  const {allowJs, packageJsonType, typecheckMode} = params;
  const name = `package.json-type=${packageJsonType} allowJs=${allowJs} ${typecheckMode}`;
  const dir = fs.mkdtempSync(`${ TEST_DIR }/tmp-`);

  for(const importStyle of importStyles) {
    for(const importerExtension of extensions) {
      createSubtest({importStyle, importerExtension});
    }
  }

  function createSubtest(subtestParams: SubtestParams) {
    const {importStyle, importerExtension} = subtestParams;
    const name = `${importerExtension.ext} ${importStyle}`;

    let importerSource = '';

    for(const importeeExtension of extensions) {
      createImportee({importeeExtension});
    }

    function createImportee(importeeParams: ImporteeParams) {
      const {importeeExtension} = importeeParams;
      fs.writeFileSync(`${ dir }/${ name }/${importeeExtension.ext}.${importeeExtension.ext}`, `

      `);
    }
  }
}
