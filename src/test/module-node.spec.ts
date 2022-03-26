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
import { createImportEqualsDeclaration, isPartiallyEmittedExpression } from 'typescript';
import { file, tempdirProject } from './fs-helpers';

const test = _test.context(contextTsNodeUnderTest);
test.beforeEach(async t => {
  resetNodeEnvironment();
})

const packageJsonTypes = [undefined, 'commonjs', 'module'] as const;
const typecheckModes = ['typecheck', 'transpileOnly', 'swc'] as const;
const importStyles = ['static import', 'require', 'dynamic import', 'import = require'] as const;
const importExtension = ['js', 'ts', 'omitted'] as const;
interface Extension {
  ext: string;
  forcesCjs: boolean;
  forcesEsm: boolean;
  isJs: boolean;
  supportsJsx: boolean;
}
const extensions = [
  {
    ext: 'cts',
    forcesCjs: true,
    forcesEsm: false,
    isJs: false,
    supportsJsx: true
  }, {
    ext: 'cjs',
    forcesCjs: true,
    forcesEsm: false,
    isJs: true,
    supportsJsx: true,
  }, {
    ext: 'mts',
    forcesCjs: false,
    forcesEsm: true,
    isJs: false,
    supportsJsx: true,
  }, {
    ext: 'mjs',
    forcesCjs: false,
    forcesEsm: true,
    isJs: true,
    supportsJsx: true,
  }, {
    ext: 'ts',
    forcesCjs: false,
    forcesEsm: false,
    isJs: false,
    supportsJsx: false,
  }, {
    ext: 'tsx',
    forcesCjs: false,
    forcesEsm: false,
    isJs: false,
    supportsJsx: true,
  }, {
    ext: 'jsx',
    forcesCjs: false,
    forcesEsm: false,
    isJs: true,
    supportsJsx: true,
  }, {
    ext: 'js',
    forcesCjs: false,
    forcesEsm: false,
    isJs: true,
    supportsJsx: false,
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
  const name = `package-json-type=${packageJsonType} allowJs=${allowJs} ${typecheckMode}`;
  const tempProject = tempdirProject();

  for(const importStyle of importStyles) {
    for(const importerExtension of extensions) {
      createSubtest({importStyle, importerExtension});
    }
  }

  function createSubtest(subtestParams: SubtestParams) {
    const {importStyle, importerExtension} = subtestParams;
    const name = `${importerExtension.ext} ${importStyle}`;

    const dir = tempProject.dir(name);

    dir.addJsonFile('package.json', {
      type: packageJsonType
    });

    dir.addJsonFile('tsconfig.json', {
      compilerOptions: {
        allowJs,
        target: 'esnext',
        module: 'nodenext'
      },
      'ts-node': {
        transpileOnly: typecheckMode === 'transpileOnly',
        swc: typecheckMode === 'swc'
      }
    });

    let importer = file(`importer.${importerExtension.ext}`, `
      async function main() {
    `);
    dir.add(importer);

    for(const importeeExtension of extensions) {
      createImportee({importeeExtension});
      switch(importStyle) {
        case 'dynamic import':
          importer.content += `await import('./${importeeExtension.ext}');\n`;
          break;
        case 'import = require':
          importer.content += `import ${importeeExtension.ext} = require('./${importeeExtension.ext}');\n`;
          break;
        case 'require':
          importer.content += `const ${importeeExtension.ext} = require('./${importeeExtension.ext}');\n`;
          break;
        case 'static import':
          importer.content += `import * as ${importeeExtension.ext} from './${importeeExtension.ext}';\n`;
          break;
      }
      importer.content += `if(${importeeExtension.ext}.ext !== '${importeeExtension.ext}') throw new Error('Wrong export from importee: expected ${importeeExtension.ext} but got ' + ${importeeExtension.ext}.ext);\n`
    }

    importer.content += `
      }
      main();
    `;

    function createImportee(importeeParams: ImporteeParams) {
      const {importeeExtension} = importeeParams;
      const f = file(`${importeeExtension.ext}.${importeeExtension.ext}`);
      const isCompiled = allowJs || !importeeExtension.isJs;
      const isExecutedAsEsm = importeeExtension.forcesEsm || (!importeeExtension.forcesCjs && packageJsonType === 'module');
      const isExecutedAsCjs = !isExecutedAsEsm;
      if(isCompiled || isExecutedAsEsm) {
        f.content += `export const ext = '${importeeExtension.ext}';\n`;
      } else {
        f.content += `exports.ext = '${importeeExtension.ext}';\n`;
      }
      if(!importeeExtension.isJs) {
        f.content += `const testTsTypeSyntax: string = 'a string';\n`;
      }
      if(isExecutedAsCjs) {
        f.content += `if(typeof __filename !== 'string') throw new Error('expected file to be CJS but __filename is not declared');\n`;
      } else {
        f.content += `if(typeof __filename !== 'undefined') throw new Error('expected file to be ESM but __filename is declared');\n`;
        f.content += `if(typeof import.meta.url !== 'string') throw new Error('expected file to be ESM but import.meta.url is not declared');\n`;
      }
      if(importeeExtension.supportsJsx) {
        f.content += `
          const React = {
            createElement(tag, dunno, content) {
              return content
            }
          };
          const jsxTest = <a>Hello World</a>;
          if(jsxTest !== 'Hello World') throw new Error('Expected ${importeeExtension.ext} to support JSX but it did not.');
        `;
      }
      dir.add(f);
    }
  }

  tempProject.write();
}
