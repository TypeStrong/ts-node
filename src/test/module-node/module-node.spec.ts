import { expect, context } from '../testlib';
import {
  CMD_TS_NODE_WITHOUT_PROJECT_FLAG,
  isOneOf,
  nodeSupportsImportingTransformedCjsFromEsm,
  resetNodeEnvironment,
  tsSupportsStableNodeNextNode16,
} from '../helpers';
import * as Path from 'path';
import { ctxTsNode } from '../helpers';
import { exec } from '../helpers/exec';
import { file, project, ProjectAPI as ProjectAPI, StringFile } from '@TypeStrong/fs-fixture-builder';

const test = context(ctxTsNode);
test.beforeEach(async () => {
  resetNodeEnvironment();
});
type Test = typeof test;

// Declare one test case for each permutations of project configuration
test.suite('TypeScript module=NodeNext and Node16', (test) => {
  test.if(tsSupportsStableNodeNextNode16 && nodeSupportsImportingTransformedCjsFromEsm);

  for (const allowJs of [true, false]) {
    for (const typecheckMode of ['typecheck', 'transpileOnly', 'swc'] as const) {
      for (const packageJsonType of [undefined, 'commonjs', 'module'] as const) {
        for (const tsModuleMode of ['NodeNext', 'Node16'] as const) {
          declareTest(test, {
            allowJs,
            packageJsonType,
            typecheckMode,
            tsModuleMode,
          });
        }
      }
    }
  }
});

function declareTest(test: Test, testParams: TestParams) {
  const name = `package-json-type=${testParams.packageJsonType} allowJs=${testParams.allowJs} ${testParams.typecheckMode} tsconfig-module=${testParams.tsModuleMode}`;

  test(name, async (t) => {
    const proj = writeFixturesToFilesystem(name, testParams);

    t.log(`Running this command: ( cd ${proj.cwd} ; ${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} --esm ./index.mjs )`);

    // All assertions happen within the fixture scripts
    // Zero exit code indicates a passing test
    const r = await exec(`${CMD_TS_NODE_WITHOUT_PROJECT_FLAG} --esm ./index.mjs`, {
      cwd: proj.cwd,
    });
    t.log(r.stdout);
    t.log(r.stderr);
    expect(r.err).toBe(null);
    expect(r.stdout).toMatch(/done\n$/);
  });
}

type PackageJsonType = typeof packageJsonTypes[number];
const packageJsonTypes = [undefined, 'commonjs', 'module'] as const;
const typecheckModes = ['typecheck', 'transpileOnly', 'swc'] as const;
const importStyles = ['static import', 'require', 'dynamic import', 'import = require'] as const;
const importExtension = ['js', 'ts', 'omitted'] as const;

interface Extension {
  ext: string;
  jsEquivalentExt?: string;
  forcesCjs?: boolean;
  forcesEsm?: boolean;
  isJs?: boolean;
  supportsJsx?: boolean;
  isJsxExt?: boolean;
  cjsAllowsOmittingExt?: boolean;
}
const extensions: Extension[] = [
  {
    ext: 'cts',
    jsEquivalentExt: 'cjs',
    forcesCjs: true,
  },
  {
    ext: 'cjs',
    forcesCjs: true,
    isJs: true,
  },
  {
    ext: 'mts',
    jsEquivalentExt: 'mjs',
    forcesEsm: true,
  },
  {
    ext: 'mjs',
    forcesEsm: true,
    isJs: true,
  },
  {
    ext: 'ts',
    jsEquivalentExt: 'js',
    cjsAllowsOmittingExt: true,
  },
  {
    ext: 'tsx',
    jsEquivalentExt: 'js',
    supportsJsx: true,
    isJsxExt: true,
    cjsAllowsOmittingExt: true,
  },
  {
    ext: 'jsx',
    jsEquivalentExt: 'js',
    isJs: true,
    supportsJsx: true,
    isJsxExt: true,
    cjsAllowsOmittingExt: true,
  },
  {
    ext: 'js',
    isJs: true,
    cjsAllowsOmittingExt: true,
  },
];
/**
 * Describe how a given project config handles files with this extension.
 * For example, projects with allowJs:false do not like .jsx
 */
function getExtensionTreatment(ext: Extension, testParams: TestParams) {
  // JSX and any TS extensions get compiled.  Everything is compiled in allowJs mode
  const isCompiled = testParams.allowJs || !ext.isJs || ext.isJsxExt;
  const isExecutedAsEsm = ext.forcesEsm || (!ext.forcesCjs && testParams.packageJsonType === 'module');
  const isExecutedAsCjs = !isExecutedAsEsm;
  // if allowJs:false, then .jsx files are not allowed
  const isAllowed = !ext.isJsxExt || !ext.isJs || testParams.allowJs;
  const canHaveJsxSyntax = ext.isJsxExt || (ext.supportsJsx && isCompiled);
  return {
    isCompiled,
    isExecutedAsCjs,
    isExecutedAsEsm,
    isAllowed,
    canHaveJsxSyntax,
  };
}

interface TestParams {
  packageJsonType: PackageJsonType;
  typecheckMode: typeof typecheckModes[number];
  allowJs: boolean;
  tsModuleMode: 'NodeNext' | 'Node16';
}

interface ImporterParams {
  importStyle: typeof importStyles[number];
  importerExtension: typeof extensions[number];
}

interface ImporteeParams {
  importeeExtension: typeof extensions[number];
}

function writeFixturesToFilesystem(name: string, testParams: TestParams) {
  const { packageJsonType, allowJs, typecheckMode, tsModuleMode } = testParams;

  const proj = project(name.replace(/ /g, '_'));

  proj.addJsonFile('package.json', {
    type: packageJsonType,
  });

  proj.addJsonFile('tsconfig.json', {
    compilerOptions: {
      allowJs,
      target: 'esnext',
      module: tsModuleMode,
      jsx: 'react',
    },
    'ts-node': {
      transpileOnly: typecheckMode === 'transpileOnly' || undefined,
      swc: typecheckMode === 'swc',
      experimentalResolver: true,
    },
  });

  const indexFile = file('index.mjs', ``);
  proj.add(indexFile);

  for (const importStyle of importStyles) {
    for (const importerExtension of extensions) {
      const importer = createImporter(proj, testParams, {
        importStyle,
        importerExtension,
      });
      if (!importer) continue;

      let importSpecifier = `./${Path.relative(proj.cwd, importer.path)}`;
      importSpecifier = replaceExtension(importSpecifier, importerExtension.jsEquivalentExt ?? importerExtension.ext);
      indexFile.content += `await import('${importSpecifier}');\n`;
    }
  }

  indexFile.content += `console.log('done');\n`;

  proj.rm();
  proj.write();
  return proj;
}

function createImporter(proj: ProjectAPI, testParams: TestParams, importerParams: ImporterParams) {
  const { importStyle, importerExtension } = importerParams;
  const name = `${importStyle} from ${importerExtension.ext}`;

  const importerTreatment = getExtensionTreatment(importerExtension, testParams);

  if (!importerTreatment.isAllowed) return;
  // import = require only allowed in non-js files
  if (importStyle === 'import = require' && importerExtension.isJs) return;
  // const = require not allowed in ESM
  if (importStyle === 'require' && importerTreatment.isExecutedAsEsm) return;
  // swc bug: import = require will not work in ESM, because swc does not emit necessary `__require = createRequire()`
  if (testParams.typecheckMode === 'swc' && importStyle === 'import = require' && importerTreatment.isExecutedAsEsm)
    return;

  const importer = {
    type: 'string',
    path: `${name.replace(/ /g, '_')}.${importerExtension.ext}`,
    imports: '',
    assertions: '',
    get content() {
      return `
          ${this.imports}
          async function main() {
            ${this.assertions}
          }
          main();
        `;
    },
  };
  proj.add(importer as StringFile);

  if (!importerExtension.isJs) importer.imports += `export {};\n`;

  for (const importeeExtension of extensions) {
    const ci = createImportee(testParams, { importeeExtension });
    if (!ci) continue;
    const { importee, treatment: importeeTreatment } = ci;
    proj.add(importee);

    // dynamic import is the only way to import ESM from CJS
    if (importeeTreatment.isExecutedAsEsm && importerTreatment.isExecutedAsCjs && importStyle !== 'dynamic import')
      continue;
    // Cannot import = require an ESM file
    if (importeeTreatment.isExecutedAsEsm && importStyle === 'import = require') continue;
    // Cannot use static imports in non-compiled non-ESM
    if (importStyle === 'static import' && !importerTreatment.isCompiled && importerTreatment.isExecutedAsCjs) continue;

    let importSpecifier = `./${importeeExtension.ext}`;
    if (!importeeExtension.cjsAllowsOmittingExt || isOneOf(importStyle, ['dynamic import', 'static import']))
      importSpecifier += '.' + (importeeExtension.jsEquivalentExt ?? importeeExtension.ext);

    switch (importStyle) {
      case 'dynamic import':
        importer.assertions += `const ${importeeExtension.ext} = await import('${importSpecifier}');\n`;
        break;
      case 'import = require':
        importer.imports += `import ${importeeExtension.ext} = require('${importSpecifier}');\n`;
        break;
      case 'require':
        importer.imports += `const ${importeeExtension.ext} = require('${importSpecifier}');\n`;
        break;
      case 'static import':
        importer.imports += `import * as ${importeeExtension.ext} from '${importSpecifier}';\n`;
        break;
    }

    // Check both namespace.ext and namespace.default.ext, because node can't detect named exports from files we transform
    const namespaceAsAny = importerExtension.isJs ? importeeExtension.ext : `(${importeeExtension.ext} as any)`;
    importer.assertions += `if((${importeeExtension.ext}.ext ?? ${namespaceAsAny}.default.ext) !== '${importeeExtension.ext}')\n`;
    importer.assertions += `  throw new Error('Wrong export from importee: expected ${importeeExtension.ext} but got ' + ${importeeExtension.ext}.ext + '(importee has these keys: ' + Object.keys(${importeeExtension.ext}) + ')');\n`;
  }
  return importer;
}
function createImportee(testParams: TestParams, importeeParams: ImporteeParams) {
  const { importeeExtension } = importeeParams;
  const importee = file(`${importeeExtension.ext}.${importeeExtension.ext}`);
  const treatment = getExtensionTreatment(importeeExtension, testParams);
  if (!treatment.isAllowed) return;
  if (treatment.isCompiled || treatment.isExecutedAsEsm) {
    importee.content += `export const ext = '${importeeExtension.ext}';\n`;
  } else {
    importee.content += `exports.ext = '${importeeExtension.ext}';\n`;
  }
  if (!importeeExtension.isJs) {
    importee.content += `const testTsTypeSyntax: string = 'a string';\n`;
  }
  if (treatment.isExecutedAsCjs) {
    importee.content += `if(typeof __filename !== 'string') throw new Error('expected file to be CJS but __filename is not declared');\n`;
  } else {
    importee.content += `if(typeof __filename !== 'undefined') throw new Error('expected file to be ESM but __filename is declared');\n`;
    importee.content += `if(typeof import.meta.url !== 'string') throw new Error('expected file to be ESM but import.meta.url is not declared');\n`;
  }
  if (treatment.canHaveJsxSyntax) {
    importee.content += `
          const React = {
            createElement(tag, dunno, content) {
              return {props: {children: [content]}};
            }
          };
          const jsxTest = <a>Hello World</a>;
          if(jsxTest?.props?.children[0] !== 'Hello World') throw new Error('Expected ${importeeExtension.ext} to support JSX but it did not.');
        `;
  }
  return { importee, treatment };
}

function replaceExtension(path: string, ext: string) {
  return Path.posix.format({
    ...Path.parse(path),
    ext: '.' + ext,
    base: undefined,
  });
}
