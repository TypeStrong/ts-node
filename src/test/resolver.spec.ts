import { context, ExecutionContext, expect, TestInterface } from './testlib';
import {
  ctxTsNode,
  isOneOf,
  resetNodeEnvironment,
  ts,
  tsSupportsMtsCtsExtensions,
  tsSupportsStableNodeNextNode16,
} from './helpers';
import { project as fsProject, Project as FsProject } from '@TypeStrong/fs-fixture-builder';
import { join } from 'path';
import * as semver from 'semver';
import { padStart } from 'lodash';
import _ = require('lodash');
import { pathToFileURL } from 'url';
import type { RegisterOptions } from '..';
import * as fs from 'fs';
import * as Path from 'path';

/*
 * Each test case is a separate TS project, with a different permutation of
 * project options.  The project is written to disc, then ts-node is installed,
 * then several entrypoint-* files are imported to test our resolver.
 *
 * High-level structure of these tests:
 *   package.json, tsconfig.json, src/, and out/
 *   entrypoint-* files are the entrypoints
 *   they import a bunch of target files / directories / node_modules
 *
 * The heart of this test is every time an entrypoint imports a target.
 * We are testing if the resolver figures out the correct target file to import.
 *
 * To better understand the emitted projects, run the tests, then look in `tests/tmp/resolver-*`
 *
 * Whenever a test fails, the error will log a command you can paste into your terminal to re-run
 * that project *outside* of this test suite.  This may be helpful in understanding and debugging
 * these tests.
 */

// Test a bunch of permutations of:

// import permutations:

//   - [x] Relative import of file
//   - [x] Relative import of index
//   - [x] rootless library import of main
//   - [x] rootless library import of index
//   - [x] rootless library import of exports sub-path
//   - [x] rootless self-import of main
//   - [x] rootless self-import of index
//   - [x] rootless self-import of exports sub-path

//     - [x] Require with extension
//     - [x] Require without extension

//     - Require from dist to dist
//     - Require from dist to src
//     - Require from src to dist
//     - [x] Require from src to src

// lib permutations:

//   - [x] module exists in both src and dist (precompilation ran)
//   - [x] module exists in only dist (came from elsewhere)
//   - [x] module exists only in src (did not precompile)

//   - .ts / .js extension
//   - .tsx / .js extension
//   - .cts / .cjs extension
//   - .mts / .mjs extension
//   - .js / .js extension
//   - .jsx / .js extension
//   - .cjs / .cjs extension
//   - .mjs / .mjs extension

// Side-step compiler transformation of import() into require()
const dynamicImport = new Function('specifier', 'return import(specifier)');
// For some reason `new Function` was triggering what *might* be a node bug,
// where `context.parentURL` passed into loader `resolve()` was wrong.
// eval works for unknown reasons.  This may change in future node releases.
const declareDynamicImportFunction = `const dynamicImport = eval('(specifier) => import(specifier)');`;

const test = context(ctxTsNode);
type Test = TestInterface<ctxTsNode.Ctx>;
type T = ExecutionContext<ctxTsNode.Ctx>;

const projectSeq = seqGenerator();
const entrypointSeq = seqGenerator();
const targetSeq = seqGenerator();

interface Project {
  identifier: string;
  allowJs: boolean;
  preferSrc: boolean;
  typeModule: boolean;
  /** Use TS's new module: `nodenext` option */
  useTsNodeNext: boolean;
  experimentalSpecifierResolutionNode: boolean;
  skipIgnore: boolean;
}
interface EntrypointPermutation {
  entrypointExt: 'cjs' | 'mjs';
  withExt: boolean;
  entrypointLocation: 'src' | 'out';
  entrypointTargetting: 'src' | 'out';
}
type Entrypoint = string;
interface GenerateTargetOptions {
  inSrc: boolean;
  inOut: boolean;
  srcExt: string;
  /** If true, is an index.* file within a directory */
  isIndex: boolean;
  targetPackageStyle: TargetPackageStyle;
  packageTypeModule: boolean;
}
interface Target {
  targetIdentifier: string;
  outName: string;
  srcName: string;
  srcExt: string;
  outExt: string;
  inSrc: boolean;
  inOut: boolean;
  /** If true, is neither an index.* nor a package */
  isNamedFile: boolean;
  /** If true, is an index.* file within a directory */
  isIndex: boolean;
  /** If true, should be imported as an npm package, not relative import */
  isPackage: boolean;
  packageStyle: TargetPackageStyle;
  typeModule: boolean;
}

/** When target is actually a mini node_modules package */
type TargetPackageStyle = typeof targetPackageStyles[number];
const targetPackageStyles = [
  false,
  // test that the package contains /index.*
  'empty-manifest',
  // "main": "src/target.<ext>"
  'main-src-with-extension',
  // "main": "src/target.<output ext>"
  'main-src-with-out-extension',
  // "main": "out/target.<output ext>"
  'main-out-with-extension',
  // "main": "src/target"
  'main-src-extensionless',
  // "main": "out/target"
  'main-out-extensionless',
  // "exports": {".": "src/target.<ext>"}
  'exports-src-with-extension',
  // "exports": {".": "src/target.<output ext>"}
  'exports-src-with-out-extension',
  // "exports": {".": "out/target.<output ext>"}
  'exports-out-with-extension',
] as const;

test.suite('Resolver hooks', (test) => {
  test.serial();
  test.if(tsSupportsMtsCtsExtensions);

  //
  // Generate all permutations of projects
  //
  for (const preferSrc of [false, true]) {
    for (const typeModule of [false, true]) {
      for (const allowJs of [false, true]) {
        for (const useTsNodeNext of [false, true]) {
          // TODO test against skipIgnore: false, where imports of third-party deps in `node_modules` should not get our mapping behaviors
          for (const skipIgnore of [/*false, */ true]) {
            for (const experimentalSpecifierResolutionNode of [false, true]) {
              let identifier = `resolver-${projectSeq()}`;
              identifier += preferSrc ? '-preferSrc' : '-preferOut';
              identifier += typeModule ? '-typeModule' : '-typeCjs---';
              identifier += allowJs ? '-allowJs' : '--------';
              identifier += useTsNodeNext ? '-useTsNodenext' : '--------------';
              identifier += skipIgnore ? '-skipIgnore' : '-----------';
              identifier += experimentalSpecifierResolutionNode ? '-experimentalSpecifierResolutionNode' : '';

              const project: Project = {
                identifier,
                allowJs,
                preferSrc,
                typeModule,
                useTsNodeNext,
                experimentalSpecifierResolutionNode,
                skipIgnore,
              };
              declareProject(test, project);
            }
          }
        }
      }
    }
  }
});

function declareProject(_test: Test, project: Project) {
  const test = project.useTsNodeNext && !tsSupportsStableNodeNextNode16 ? _test.skip : _test;
  test(`${project.identifier}`, async (t) => {
    t.teardown(() => {
      resetNodeEnvironment();
    });

    const p = fsProject(project.identifier);
    p.rm();

    p.addJsonFile('package.json', {
      type: project.typeModule ? 'module' : undefined,
    });
    p.addJsonFile('tsconfig.json', {
      'ts-node': {
        experimentalResolver: true,
        preferTsExts: project.preferSrc,
        transpileOnly: true,
        experimentalSpecifierResolution: project.experimentalSpecifierResolutionNode ? 'node' : undefined,
        skipIgnore: project.skipIgnore,
      } as RegisterOptions,
      compilerOptions: {
        allowJs: project.allowJs,
        skipLibCheck: true,
        // TODO add nodenext permutation
        module: project.useTsNodeNext ? 'NodeNext' : project.typeModule ? 'esnext' : 'commonjs',
        jsx: 'react',
        target: 'esnext',
      },
    });

    const targets = generateTargets(project, p);
    const entrypoints = generateEntrypoints(project, p, targets);
    p.write();
    await execute(t, p, entrypoints);
  });
}

//
// Generate all target-* files
//
function generateTargets(project: Project, p: FsProject) {
  /** Array of metadata about target files to be imported */
  const targets: Array<Target> = [];
  // TODO does allowJs matter?
  for (const inOut of [false, true]) {
    for (const inSrc of [false, true]) {
      for (const srcExt of ['ts', 'tsx', 'cts', 'mts', 'jsx', 'js', 'cjs', 'mjs']) {
        for (const targetPackageStyle of targetPackageStyles) {
          const packageTypeModulePermutations = targetPackageStyle ? [true, false] : [project.typeModule];
          for (const packageTypeModule of packageTypeModulePermutations) {
            const isIndexPermutations = targetPackageStyle ? [false] : [true, false];
            // TODO test main pointing to a directory containing an `index.` file?
            for (const isIndex of isIndexPermutations) {
              //#region SKIPPING
              if (!inSrc && !inOut) continue;

              // Don't bother with jsx if we don't have allowJs enabled
              // TODO Get rid of this?  "Just work" in this case?
              if (srcExt === 'jsx' && !project.allowJs) continue;
              // Don't bother with src-only extensions when only emitting to `out`
              if (!inSrc && ['ts', 'tsx', 'cts', 'mts', 'jsx'].includes(srcExt)) continue;

              // TODO re-enable with src <-> out mapping
              if (
                !inOut &&
                isOneOf(targetPackageStyle, [
                  'main-out-with-extension',
                  'main-out-extensionless',
                  'exports-out-with-extension',
                ])
              )
                continue;
              if (
                !inSrc &&
                isOneOf(targetPackageStyle, [
                  'main-src-with-extension',
                  'main-src-extensionless',
                  'exports-src-with-extension',
                ])
              )
                continue;
              if (
                isOneOf(targetPackageStyle, [
                  'main-out-with-extension',
                  'main-out-extensionless',
                  'exports-out-with-extension',
                ])
              )
                continue;
              //#endregion

              targets.push(
                generateTarget(project, p, {
                  inSrc,
                  inOut,
                  srcExt,
                  targetPackageStyle,
                  packageTypeModule,
                  isIndex,
                })
              );
            }
          }
        }
      }
    }
  }
  return targets;
}

function generateTarget(project: Project, p: FsProject, options: GenerateTargetOptions) {
  const { inSrc, inOut, srcExt, targetPackageStyle, packageTypeModule, isIndex } = options;

  const outExt = srcExt.replace('ts', 'js').replace('x', '');
  let targetIdentifier = `target-${targetSeq()}-${inOut && inSrc ? 'inboth' : inOut ? 'onlyout' : 'onlysrc'}-${srcExt}`;

  if (targetPackageStyle)
    targetIdentifier = `${targetIdentifier}-${targetPackageStyle}-${packageTypeModule ? 'module' : 'commonjs'}`;
  let prefix = targetPackageStyle ? `node_modules/${targetIdentifier}/` : '';
  let suffix = targetPackageStyle === 'empty-manifest' ? 'index' : targetPackageStyle ? 'target' : targetIdentifier;
  if (isIndex) suffix += '-dir/index';
  const srcDirInfix = targetPackageStyle === 'empty-manifest' ? '' : 'src/';
  const outDirInfix = targetPackageStyle === 'empty-manifest' ? '' : 'out/';
  const srcName = `${prefix}${srcDirInfix}${suffix}.${srcExt}`;
  const srcDirOutExtName = `${prefix}${srcDirInfix}${suffix}.${outExt}`;
  const outName = `${prefix}${outDirInfix}${suffix}.${outExt}`;
  const selfImporterCjsName = `${prefix}self-import-cjs.cjs`;
  const selfImporterMjsName = `${prefix}self-import-mjs.mjs`;
  const target: Target = {
    targetIdentifier,
    srcName,
    outName,
    srcExt,
    outExt,
    inSrc,
    inOut,
    isNamedFile: !isIndex && !targetPackageStyle,
    isIndex,
    isPackage: !!targetPackageStyle,
    packageStyle: targetPackageStyle,
    typeModule: packageTypeModule,
  };
  const { isMjs: targetIsMjs } = fileInfo('.' + srcExt, packageTypeModule, project.allowJs);
  function targetContent(loc: string) {
    let content = '';
    if (targetIsMjs) {
      content += String.raw`
        const {fileURLToPath} = await import('url');
        const filenameNative = fileURLToPath(import.meta.url);
        export const directory = filenameNative.replace(/.*[\\\/](.*?)[\\\/]/, '$1');
        export const filename = filenameNative.replace(/.*[\\\/]/, '');
        export const targetIdentifier = '${targetIdentifier}';
        export const ext = filenameNative.replace(/.*\./, '');
        export const loc = '${loc}';
      `;
    } else {
      content += String.raw`
        const filenameNative = __filename;
        exports.filename = filenameNative.replace(/.*[\\\/]/, '');
        exports.directory = filenameNative.replace(/.*[\\\/](.*?)[\\\/].*/, '$1');
        exports.targetIdentifier = '${targetIdentifier}';
        exports.ext = filenameNative.replace(/.*\./, '');
        exports.loc = '${loc}';
      `;
    }
    return content;
  }
  if (inOut) {
    p.addFile(outName, targetContent('out'));
    // TODO so we can test multiple file extensions in a single directory, preferTsExt
    p.addFile(srcDirOutExtName, targetContent('out'));
  }
  if (inSrc) {
    p.addFile(srcName, targetContent('src'));
  }
  if (targetPackageStyle) {
    const selfImporterIsCompiled = project.allowJs;
    const cjsSelfImporterMustUseDynamicImportHack = !project.useTsNodeNext && selfImporterIsCompiled && targetIsMjs;
    p.addFile(
      selfImporterCjsName,
      targetIsMjs
        ? cjsSelfImporterMustUseDynamicImportHack
          ? `${declareDynamicImportFunction}\nmodule.exports = dynamicImport('${targetIdentifier}');`
          : `module.exports = import("${targetIdentifier}");`
        : `module.exports = require("${targetIdentifier}");`
    );
    p.addFile(
      selfImporterMjsName,
      `
        export * from "${targetIdentifier}";
      `
    );
    function writePackageJson(obj: any) {
      p.addJsonFile(`${prefix}/package.json`, {
        name: targetIdentifier,
        type: packageTypeModule ? 'module' : undefined,
        ...obj,
      });
    }
    switch (targetPackageStyle) {
      case 'empty-manifest':
        writePackageJson({});
        break;
      case 'exports-src-with-extension':
        writePackageJson({
          exports: {
            '.': `./src/${suffix}.${srcExt}`,
          },
        });
        break;
      case 'exports-src-with-out-extension':
        writePackageJson({
          exports: {
            '.': `./src/${suffix}.${outExt}`,
          },
        });
        break;
      case 'exports-out-with-extension':
        writePackageJson({
          exports: {
            '.': `./out/${suffix}.${outExt}`,
          },
        });
        break;
      case 'main-src-extensionless':
        writePackageJson({
          main: `src/${suffix}`,
        });
        break;
      case 'main-out-extensionless':
        writePackageJson({
          main: `out/${suffix}`,
        });
        break;
      case 'main-src-with-extension':
        writePackageJson({
          main: `src/${suffix}.${srcExt}`,
        });
        break;
      case 'main-src-with-out-extension':
        writePackageJson({
          main: `src/${suffix}.${outExt}`,
        });
        break;
      case 'main-out-with-extension':
        writePackageJson({
          main: `src/${suffix}.${outExt}`,
        });
        break;
      default:
        const _assert: never = targetPackageStyle;
    }
  }
  return target;
}

/**
 * Generate all entrypoint-* files
 */
function generateEntrypoints(project: Project, p: FsProject, targets: Target[]) {
  /** Array of entrypoint files to be imported during the test */
  let entrypoints: string[] = [];
  for (const entrypointExt of ['cjs', 'mjs'] as const) {
    // TODO consider removing this logic; deferring to conditionals in the generateEntrypoint which emit meaningful comments
    const withExtPermutations =
      entrypointExt == 'mjs' && project.experimentalSpecifierResolutionNode === false ? [true] : [false, true];
    for (const withExt of withExtPermutations) {
      // Location of the entrypoint
      for (const entrypointLocation of ['src', 'out'] as const) {
        // Target of the entrypoint's import statements
        for (const entrypointTargetting of ['src', 'out'] as const) {
          // TODO re-enable when we have out <-> src mapping
          if (entrypointLocation !== 'src') continue;
          if (entrypointTargetting !== 'src') continue;

          entrypoints.push(
            generateEntrypoint(project, p, targets, {
              entrypointExt,
              withExt,
              entrypointLocation,
              entrypointTargetting,
            })
          );
        }
      }
    }
  }
  return entrypoints;
}

function generateEntrypoint(project: Project, p: FsProject, targets: Target[], opts: EntrypointPermutation) {
  const { entrypointExt, withExt, entrypointLocation, entrypointTargetting } = opts;
  const entrypointFilename = `entrypoint-${entrypointSeq()}-${entrypointLocation}-to-${entrypointTargetting}${
    withExt ? '-withext' : ''
  }.${entrypointExt}`;
  const { isMjs: entrypointIsMjs, isCompiled: entrypointIsCompiled } = fileInfo(
    entrypointFilename,
    project.typeModule,
    project.allowJs
  );
  let entrypointContent = 'let mod;\n';
  entrypointContent += 'let testsRun = 0;\n';
  if (entrypointIsMjs) {
    entrypointContent += `import assert from 'assert';\n`;
  } else {
    entrypointContent += `const assert = require('assert');\n`;
    entrypointContent += `${declareDynamicImportFunction}\n`;
  }
  entrypointContent += `async function main() {\n`;

  for (const target of targets) {
    // TODO re-enable these when we have outDir <-> rootDir mapping
    if (target.srcName.includes('onlyout') && entrypointTargetting === 'src') continue;
    if (target.srcName.includes('onlysrc') && entrypointTargetting === 'out') continue;

    const {
      ext: targetSrcExt,
      isMjs: targetIsMjs,
      isCompiled: targetIsCompiled,
    } = fileInfo(target.srcName, target.typeModule, project.allowJs);

    let targetExtPermutations = [''];
    if (!target.isPackage) {
      if (entrypointTargetting === 'out' && target.outExt !== target.srcExt) {
        // TODO re-enable when we have out <-> src mapping
        targetExtPermutations = [target.outExt];
      } else if (target.srcExt !== target.outExt) {
        targetExtPermutations = [target.srcExt, target.outExt];
      } else {
        targetExtPermutations = [target.srcExt];
      }
    }
    const externalPackageSelfImportPermutations = target.isPackage ? [false, true] : [false];
    for (const targetExt of targetExtPermutations) {
      for (const externalPackageSelfImport of externalPackageSelfImportPermutations) {
        entrypointContent += `\n// ${target.targetIdentifier}`;
        if (target.isPackage) {
          entrypointContent += ` node_modules package`;
          if (externalPackageSelfImport) {
            entrypointContent += ` self-import`;
          }
        } else {
          entrypointContent += `.${targetExt}`;
        }
        entrypointContent += '\n';

        // should specifier be relative or absolute?
        let specifier: string;
        if (externalPackageSelfImport) {
          specifier = `../node_modules/${target.targetIdentifier}/self-import-${entrypointExt}.${entrypointExt}`;
        } else if (target.isPackage) {
          specifier = target.targetIdentifier;
        } else {
          if (entrypointTargetting === entrypointLocation) specifier = './';
          else specifier = `../${entrypointTargetting}/`;
          specifier += target.targetIdentifier;
          if (target.isIndex) specifier += '-dir';
          if (!target.isIndex && withExt) specifier += '.' + targetExt;
        }

        //#region SKIPPING
        if (target.isNamedFile && !withExt) {
          // Do not try to import cjs/cts without extension; node always requires these extensions
          if (target.outExt === 'cjs') {
            entrypointContent += `// skipping ${specifier} because we cannot omit extension from cjs / cts files; node always requires them\n`;
            continue;
          }
          // Do not try to import mjs/mts unless experimental-specifier-resolution is turned on
          if (target.outExt === 'mjs' && !project.experimentalSpecifierResolutionNode) {
            entrypointContent += `// skipping ${specifier} because we cannot omit extension from mjs/mts unless experimental-specifier-resolution=node\n`;
            continue;
          }
          // Do not try to import anything extensionless via ESM loader unless experimental-specifier-resolution is turned on
          if ((targetIsMjs || entrypointIsMjs) && !project.experimentalSpecifierResolutionNode) {
            entrypointContent += `// skipping ${specifier} because we cannot omit extension via esm loader unless experimental-specifier-resolution=node\n`;
            continue;
          }
        }
        if (
          target.isPackage &&
          isOneOf(target.packageStyle, ['empty-manifest', 'main-out-extensionless', 'main-src-extensionless']) &&
          isOneOf(target.outExt, ['cjs', 'mjs'])
        ) {
          entrypointContent += `// skipping ${specifier} because it points to a node_modules package that tries to omit file extension, and node does not allow omitting cjs/mjs extension\n`;
          continue;
        }

        // Do not try to import a transpiled file if compiler options disagree with node's extension-based classification
        if (!project.useTsNodeNext && targetIsCompiled) {
          if (targetIsMjs && !project.typeModule) {
            entrypointContent += `// skipping ${specifier} because it is compiled and compiler options disagree with node's module classification: extension=${targetSrcExt}, tsconfig module=commonjs\n`;
            continue;
          }
          if (!targetIsMjs && project.typeModule) {
            entrypointContent += `// skipping ${specifier} because it is compiled and compiler options disagree with node's module classification: extension=${targetSrcExt}, tsconfig module=esnext\n`;
            continue;
          }
        }

        // Do not try to import index from a directory if is forbidden by node's ESM resolver
        if (target.isIndex) {
          if ((targetIsMjs || entrypointIsMjs) && !project.experimentalSpecifierResolutionNode) {
            entrypointContent += `// skipping ${specifier} because esm loader does not allow directory ./index imports unless experimental-specifier-resolution=node\n`;
            continue;
          }
          if (target.outExt === 'cjs') {
            entrypointContent += `// skipping ${specifier} because it relies on node automatically resolving a directory to index.cjs/cts , but node does not support those extensions for index.* files, only .js (and equivalents), .node, .json\n`;
            continue;
          }
        }
        //#endregion

        // NOTE: if you try to explicitly import foo.ts, we will load foo.ts, EVEN IF you have `preferTsExts` off
        const assertIsSrcOrOut = !target.inSrc
          ? 'out'
          : !target.inOut
          ? 'src'
          : project.preferSrc ||
            (!target.isIndex && targetExt === target.srcExt && withExt) ||
            target.srcExt === target.outExt || // <-- TODO re-enable when we have src <-> out mapping
            (target.isPackage &&
              isOneOf(target.packageStyle, ['main-src-with-extension', 'exports-src-with-extension']))
          ? 'src'
          : 'out';
        const assertHasExt = assertIsSrcOrOut === 'src' ? target.srcExt : target.outExt;

        // If entrypoint is compiled as CJS, and *not* with TS's nodenext, then TS transforms `import` into `require`,
        // so we must hack around the compiler to get a true `import`.
        const entrypointMustUseDynamicImportHack =
          !project.useTsNodeNext && entrypointIsCompiled && !entrypointIsMjs && !externalPackageSelfImport;
        entrypointContent +=
          entrypointExt === 'cjs' && (externalPackageSelfImport || !targetIsMjs)
            ? `  mod = await require('${specifier}');\n`
            : entrypointMustUseDynamicImportHack
            ? `  mod = await dynamicImport('${specifier}');\n`
            : `  mod = await import('${specifier}');\n`;
        entrypointContent += `  assert.equal(mod.loc, '${assertIsSrcOrOut}');\n`;
        entrypointContent += `  assert.equal(mod.targetIdentifier, '${target.targetIdentifier}');\n`;
        entrypointContent += `  assert.equal(mod.ext, '${assertHasExt}');\n`;
        entrypointContent += `  testsRun++;\n`;
      }
    }
  }
  entrypointContent += `}\n`;
  entrypointContent += `const result = main().then(() => {return testsRun});\n`;
  entrypointContent += `result.mark = 'marked';\n`;
  if (entrypointIsMjs) {
    entrypointContent += `export {result};\n`;
  } else {
    entrypointContent += `exports.result = result;\n`;
  }
  p.dir(entrypointLocation).addFile(entrypointFilename, entrypointContent);
  return entrypointLocation + '/' + entrypointFilename;
}

/**
 * Assertions happen here
 */
async function execute(t: T, p: FsProject, entrypoints: Entrypoint[]) {
  //
  // Install ts-node and try to import all the index-* files
  //

  const service = t.context.tsNodeUnderTest.register({
    projectSearchDir: p.cwd,
  });
  process.__test_setloader__(t.context.tsNodeUnderTest.createEsmHooks(service));

  for (const entrypoint of entrypoints) {
    t.log(`Importing ${join(p.cwd, entrypoint)}`);
    try {
      const { result } = await dynamicImport(pathToFileURL(join(p.cwd, entrypoint)));
      expect(result).toBeInstanceOf(Promise);
      expect(result.mark).toBe('marked');
      const testsRun = await result;
      t.log(`Entrypoint ran ${testsRun} tests.`);
    } catch (e) {
      try {
        const launchJsonPath = Path.resolve(__dirname, '../../.vscode/launch.json');
        const launchJson = JSON.parse(fs.readFileSync(launchJsonPath, 'utf8'));
        const config = launchJson.configurations.find((c: any) => c.name === 'Debug resolver test');
        config.cwd = Path.join('${workspaceFolder}', Path.relative(Path.resolve(__dirname, '../..'), p.cwd));
        config.program = `./${entrypoint}`;
        fs.writeFileSync(launchJsonPath, JSON.stringify(launchJson, null, 2));
      } catch {}
      throw new Error(
        [
          (e as Error).message,
          (e as Error).stack,
          '',
          'This is an error in a resolver test. It might be easier to investigate by running outside of the test suite.',
          'To do that, try pasting this into your bash shell (windows invocation will be similar but maybe not identical):',
          `    ( cd ${p.cwd} ; node --loader ../../../esm.mjs ./${entrypoint} )`,
        ].join('\n')
      );
    }
  }
}

function fileInfo(filename: string, typeModule: boolean, allowJs: boolean) {
  const ext = filename.match(/\.(.*)$/)?.[1] ?? filename;
  // ['ts', 'tsx', 'cts', 'mts', 'js', 'jsx', 'cjs', 'mjs']
  return {
    ext,
    isMjs: ['mts', 'mjs'].includes(ext) ? true : ['cts', 'cjs'].includes(ext) ? false : typeModule,
    isCompiled: allowJs || ['ts', 'tsx', 'jsx', 'mts', 'cts'].includes(ext),
  };
}

function seqGenerator() {
  let next = 0;
  return function () {
    return padStart('' + next++, 4, '0');
  };
}
