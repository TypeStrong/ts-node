import { context, ExecutionContext, TestInterface } from './testlib';
import { ctxTsNode, resetNodeEnvironment } from './helpers';
import { project as fsProject, Project as FsProject } from './fs-helpers';
import { join } from 'path';
import * as semver from 'semver';
import { padStart } from 'lodash';
import { isIndexedAccessTypeNode, isWhiteSpaceLike } from 'typescript';

// TODO with skipIgnore turned off, `node_modules` imports of output extension should not resolve to src extension

// Side-step compiler transformation of import() into require()
const dynamicImport = new Function('specifier', 'return import(specifier)');

const test = context(ctxTsNode);
type Test = TestInterface<ctxTsNode.Ctx>;
type T = ExecutionContext<ctxTsNode.Ctx>;

/*
 * Each test case is a separate TS project, with a different permutation of
 * project options.  The project is written to disc, then ts-node is installed,
 * then several entrypoint-* files are imported to test our resolver.
 *
 * High-level structure of these tests:
 *   package.json, tsconfig.json, src/, and out/
 *   entrypoint-* files are the entrypoints
 *   they import a bunch of target-* files
 *
 * The heart of this test is every time an entrypoint imports a target.
 * We are testing if the resolver figures out the correct target-* file to import.
 *
 * To better understand the emitted projects, run the tests, then look in `tests/tmp/resolver-*`
 *
 * Whenever a test fails, the error will log a command you can paste into your terminal to re-run
 * that project *outside* of this test suite.  This may be helpful in understanding and debugging
 * these tests.
 */

const projectSeq = seqGenerator();
const entrypointSeq = seqGenerator();
const targetSeq = seqGenerator();

interface Project {
  identifier: string;
  allowJs: boolean;
  preferSrc: boolean;
  typeModule: boolean;
  experimentalSpecifierResolutionNode: boolean;
}
type Entrypoint = string;
interface Target {
  /** If true, is an index.* file within a directory */
  isIndex: boolean;
  targetIdentifier: string;
  outName: string;
  srcName: string;
  srcExt: string;
  outExt: string;
  inSrc: boolean;
  inOut: boolean;
  /** If true, should be imported as an npm package, not relative import */
  isPackage: boolean;
  packageFlavor: ExternalPackageFlavor;
  typeModule: boolean;
}
test.suite('Resolver hooks', (test) => {
  test.runSerially();
  test.runIf(semver.gte(process.version, '14.0.0'));

  //
  // Generate all permutations of projects
  //
  for (const allowJs of [false, true]) {
    for (const preferSrc of [false, true]) {
      for (const typeModule of [false, true]) {
        for (const experimentalSpecifierResolutionNode of [false, true]) {
          const project: Project = {
            identifier: `resolver-${projectSeq()}-${
              preferSrc ? 'preferSrc' : 'preferOut'
            }-${typeModule ? 'typeModule' : 'typeCommonjs'}${
              allowJs ? '-allowJs' : ''
            }${
              experimentalSpecifierResolutionNode
                ? '-experimentalSpecifierResolutionNode'
                : ''
            }`,
            allowJs,
            preferSrc,
            typeModule,
            experimentalSpecifierResolutionNode,
          };
          declareProject(test, project);
        }
      }
    }
  }
});

function declareProject(test: Test, project: Project) {
  const {
    allowJs,
    experimentalSpecifierResolutionNode,
    preferSrc,
    typeModule,
  } = project;

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
        // TODO rename this option?  Or keep the legacy name
        preferSrc,
        preferTsExts: preferSrc,
        transpileOnly: true,
        experimentalSpecifierResolution: experimentalSpecifierResolutionNode
          ? 'node'
          : undefined,
        skipIgnore: true,
      },
      compilerOptions: {
        allowJs,
        skipLibCheck: true,
        // TODO add nodenext permutation
        module: typeModule ? 'esnext' : 'commonjs',
        jsx: 'react',
      },
    });

    const targets = generateTargets(project, p);
    const entrypoints = generateEntrypoints(project, p, targets);
    p.write();
    await execute(t, p, entrypoints);
  });
}
type ExternalPackageFlavor = typeof externalPackageFlavors[number];
const externalPackageFlavors = [
  false,
  'main-src-with-extension',
  'main-src-with-out-extension',
  'main-out-with-extension',
  'main-src-extensionless',
  'main-out-extensionless',
  'exports-src-with-extension',
  'exports-src-with-out-extension',
  'exports-out-with-extension',
] as const;
function generateTargets(project: Project, p: FsProject) {
  //
  // Generate all target-* files
  //

  /** Array of metadata about target files to be imported */
  const targets: Array<Target> = [];
  // TODO does allowJs matter?
  for (const inOut of [false, true]) {
    for (const inSrc of [false, true]) {
      for (const srcExt of [
        'ts',
        'tsx',
        'cts',
        'mts',
        'jsx',
        'js',
        'cjs',
        'mjs',
      ]) {
        for (const externalPackageFlavor of externalPackageFlavors) {
          const targetPackageTypeModulePermutations = externalPackageFlavor
            ? [true, false]
            : [project.typeModule];
          for (const targetPackageTypeModule of targetPackageTypeModulePermutations) {
            const isIndexPermutations = externalPackageFlavor
              ? [false]
              : [true, false];
            // TODO test main pointing to a directory containing an `index.` file?
            for (const isIndex of isIndexPermutations) {
              //#region SKIPPING
              if (!inSrc && !inOut) continue;

              // Don't bother with jsx if we don't have allowJs enabled
              // TODO Get rid of this?  "Just work" in this case?
              if (srcExt === 'jsx' && !project.allowJs) continue;
              // Don't bother with src-only extensions when only emitting to `out`
              if (!inSrc && ['ts', 'tsx', 'cts', 'mts', 'jsx'].includes(srcExt))
                continue;

              // TODO re-enable with src <-> out mapping
              if (
                !inOut &&
                [
                  'main-out-with-extension',
                  'main-out-extensionless',
                  'exports-out-with-extension',
                ].includes(externalPackageFlavor as any)
              )
                continue;
              if (
                !inSrc &&
                [
                  'main-src-with-extension',
                  'main-src-extensionless',
                  'exports-src-with-extension',
                ].includes(externalPackageFlavor as any)
              )
                continue;
              if (
                [
                  'main-out-with-extension',
                  'main-out-extensionless',
                  'exports-out-with-extension',
                ].includes(externalPackageFlavor as any)
              )
                continue;
              //#endregion

              const outExt = srcExt.replace('ts', 'js').replace('x', '');
              let targetIdentifier = `target-${targetSeq()}-${
                inOut && inSrc ? 'inboth' : inOut ? 'onlyout' : 'onlysrc'
              }-${srcExt}`;

              if (externalPackageFlavor)
                targetIdentifier = `${targetIdentifier}-${externalPackageFlavor}-${
                  targetPackageTypeModule ? 'module' : 'commonjs'
                }`;
              let prefix = externalPackageFlavor
                ? `node_modules/${targetIdentifier}/`
                : '';
              let suffix = externalPackageFlavor ? 'target' : targetIdentifier;
              if (isIndex) suffix += '-dir/index';
              const srcName = `${prefix}src/${suffix}.${srcExt}`;
              const srcDirOutExtName = `${prefix}src/${suffix}.${outExt}`;
              const outName = `${prefix}out/${suffix}.${outExt}`;
              const target: Target = {
                srcName,
                outName,
                srcExt,
                outExt,
                inSrc,
                inOut,
                isIndex,
                targetIdentifier,
                isPackage: !!externalPackageFlavor,
                packageFlavor: externalPackageFlavor,
                typeModule: targetPackageTypeModule,
              };
              targets.push(target);
              const { isMjs: targetIsMjs } = fileInfo(
                '.' + srcExt,
                targetPackageTypeModule,
                project.allowJs
              );
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
              function writePackageJson(obj: any) {
                p.addJsonFile(`${prefix}/package.json`, {
                  type: targetPackageTypeModule ? 'module' : undefined,
                  ...obj,
                });
              }
              switch (externalPackageFlavor) {
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
                  const _assert: false = externalPackageFlavor;
              }
            }
          }
        }
      }
    }
  }
  return targets;
}

/**
 * Generate all entrypoint-* files
 */
function generateEntrypoints(
  project: Project,
  p: FsProject,
  targets: Target[]
) {
  /** Array of entrypoint files to be imported during the test */
  let entrypoints: string[] = [];
  for (const entrypointExt of ['cjs', 'mjs'] as const) {
    const withExtPermutations =
      entrypointExt == 'mjs' &&
      project.experimentalSpecifierResolutionNode === false
        ? [true]
        : [false, true];
    for (const withExt of withExtPermutations) {
      // Location of the entrypoint
      for (const entrypointLocation of ['src', 'out'] as const) {
        // Target of the entrypoint's import statements
        for (const entrypointTargetting of ['src', 'out'] as const) {
          // TODO
          if (entrypointLocation !== 'src') continue;
          if (entrypointTargetting !== 'src') continue;

          const entrypointFilename = `entrypoint-${entrypointSeq()}-${entrypointLocation}-to-${entrypointTargetting}${
            withExt ? '-withext' : ''
          }.${entrypointExt}`;
          const { isMjs: entrypointIsMjs } = fileInfo(
            entrypointFilename,
            project.typeModule,
            project.allowJs
          );
          let entrypointContent = 'let mod;\n';
          if (entrypointIsMjs) {
            entrypointContent += `import assert from 'assert';\n`;
          } else {
            entrypointContent += `const assert = require('assert');\n`;
          }

          entrypoints.push(entrypointLocation + '/' + entrypointFilename);
          for (const target of targets) {
            // TODO re-enable these when we have outDir <-> rootDir mapping
            if (
              target.srcName.includes('onlyout') &&
              entrypointTargetting === 'src'
            )
              continue;
            if (
              target.srcName.includes('onlysrc') &&
              //@ts-expect-error
              entrypointTargetting === 'out'
            )
              continue;

            const {
              ext: targetSrcExt,
              isMjs: targetIsMjs,
              isCompiled: targetIsCompiled,
            } = fileInfo(target.srcName, target.typeModule, project.allowJs);
            const { ext: targetOutExt } = fileInfo(
              target.outName,
              project.typeModule,
              project.allowJs
            );

            let targetExtPermutations = [''];
            if (!target.isPackage) {
              if (
                // @ts-expect-error
                entrypointTargetting === 'out' &&
                target.outExt !== target.srcExt
              ) {
                // TODO re-enable when we have out <-> src mapping
                targetExtPermutations = [target.outExt];
              } else if (target.srcExt !== target.outExt) {
                targetExtPermutations = [target.srcExt, target.outExt];
              } else {
                targetExtPermutations = [target.srcExt];
              }
            }
            for (const targetExt of targetExtPermutations) {
              entrypointContent += `\n// ${target.targetIdentifier}`;
              if (target.isPackage) {
                entrypointContent + ' node_modules package';
              } else {
                entrypointContent += `.${targetExt}`;
              }
              entrypointContent += '\n';

              // should specifier be relative or absolute?
              let specifier: string;
              if (target.isPackage) {
                specifier = target.targetIdentifier;
              } else {
                if (entrypointTargetting === entrypointLocation)
                  specifier = './';
                else specifier = `../${entrypointTargetting}/`;
                specifier += target.targetIdentifier;
                if (target.isIndex) specifier += '-dir';
                if (!target.isIndex && withExt) specifier += '.' + targetExt;
              }

              // Do not try to import mjs from cjs
              if (targetIsMjs && entrypointExt === 'cjs') {
                entrypointContent += `// skipping ${specifier} because we cannot import mjs from cjs\n`;
                continue;
              }

              // Do not try to import mjs or cjs without extension; node always requires these extensions, even in CommonJS.
              if (
                !withExt &&
                (targetSrcExt === 'cjs' || targetSrcExt === 'mjs')
              ) {
                entrypointContent += `// skipping ${specifier} because we cannot omit extension from cjs or mjs files; node always requires them\n`;
                continue;
              }

              // Do not try to import a transpiled file if compiler options disagree with node's extension-based classification
              if (targetIsCompiled && targetIsMjs && !project.typeModule) {
                entrypointContent += `// skipping ${specifier} because it is compiled and compiler options disagree with node's module classification: extension=${targetSrcExt}, tsconfig module=commonjs\n`;
                continue;
              }
              if (targetIsCompiled && !targetIsMjs && project.typeModule) {
                entrypointContent += `// skipping ${specifier} because it is compiled and compiler options disagree with node's module classification: extension=${targetSrcExt}, tsconfig module=esnext\n`;
                continue;
              }
              // Do not try to import cjs/mjs/cts/mts extensions because they are being added by a different pull request
              if (['cts', 'mts', 'cjs', 'mjs'].includes(targetSrcExt)) {
                entrypointContent += `// skipping ${specifier} because it uses a file extension that requires us to merge the relevant pull request\n`;
                continue;
              }

              // Do not try to import index from a directory if is forbidden by node's ESM resolver
              if (
                entrypointIsMjs &&
                target.isIndex &&
                !project.experimentalSpecifierResolutionNode
              ) {
                entrypointContent += `// skipping ${specifier} because it relies on node automatically resolving a directory to index.*, but experimental-specifier-resolution is not enabled\n`;
                continue;
              }

              // NOTE: if you try to explicitly import foo.ts, we will load foo.ts, EVEN IF you have `preferTsExts` off
              const assertIsSrcOrOut = !target.inSrc
                ? 'out'
                : !target.inOut
                ? 'src'
                : project.preferSrc ||
                  (!target.isIndex && targetExt === target.srcExt && withExt) ||
                  target.srcExt === target.outExt || // <-- TODO re-enable when we have src <-> out mapping
                  (target.isPackage &&
                    [
                      'main-src-with-extension',
                      'exports-src-with-extension',
                    ].includes(target.packageFlavor as any))
                ? 'src'
                : 'out';
              const assertHasExt =
                assertIsSrcOrOut === 'src' ? target.srcExt : target.outExt;

              entrypointContent +=
                entrypointExt === 'cjs'
                  ? `mod = require('${specifier}');\n`
                  : `mod = await import('${specifier}');\n`;
              entrypointContent += `assert.equal(mod.loc, '${assertIsSrcOrOut}');\n`;
              entrypointContent += `assert.equal(mod.targetIdentifier, '${target.targetIdentifier}');\n`;
              entrypointContent += `assert.equal(mod.ext, '${assertHasExt}');\n`;
              // indexContent += `assert.equal(mod.filename.match(/^.*?\\./)[0], '${assertHasName}');\n`;
              // indexContent += `assert.equal(mod.filename.match(/\\..*?$/)[0], '.${assertHasExtension}');\n`;
            }
          }
          p.dir(entrypointLocation).addFile(
            entrypointFilename,
            entrypointContent
          );
        }
      }
    }
  }
  return entrypoints;
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
    try {
      await dynamicImport(join(p.cwd, entrypoint));
    } catch (e) {
      throw new Error(
        [
          (e as Error).message,
          '',
          'This is an error in a resolver test. It might be easier to investigate by running outside of the test suite.',
          'To do that, try pasting this into your bash shell (windows invocation will be similar but maybe not identical):',
          `( cd ${p.cwd} ; node --loader ../../../esm.mjs ./${entrypoint} )`,
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
    isMjs: ['mts', 'mjs'].includes(ext)
      ? true
      : ['cts', 'cjs'].includes(ext)
      ? false
      : typeModule,
    isCompiled: allowJs || ['ts', 'tsx', 'jsx', 'mts', 'cts'].includes(ext),
  };
}

function seqGenerator() {
  let next = 0;
  return function () {
    return padStart('' + next++, 4, '0');
  };
}

// Test a bunch of permutations of:

// config permutations:

// - allowJs
// - not allowJs

// - preferSrc
// - not preferSrc

// import permutations:

//   - Relative import of file
//   - Relative import of index
//   - rootless library import of main
//   - rootless library import of index
//   - rootless library import of exports sub-path
//   - rootless self-import of main
//   - rootless self-import of index
//   - rootless self-import of exports sub-path

//     - Require with extension
//     - Require without extension

//     - Require from dist to dist
//     - Require from dist to src
//     - Require from src to dist
//     - Require from src to src

// lib permutations:

//   - module exists in both src and dist (precompilation ran)
//   - module exists in only dist (came from elsewhere)
//   - module exists only in src (did not precompile)

//   - .ts / .js extension
//   - .tsx / .js extension
//   - .cts / .cjs extension
//   - .mts / .mjs extension
//   - .js / .js extension
//   - .jsx / .js extension
//   - .cjs / .cjs extension
//   - .mjs / .mjs extension
