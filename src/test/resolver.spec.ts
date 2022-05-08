import { context } from './testlib';
import { ctxTsNode, resetNodeEnvironment } from './helpers';
import { project } from './fs-helpers';
import { join } from 'path';

const test = context(ctxTsNode);
test.suite('Resolver hooks', (test) => {
  test.runSerially();

  /*
   * Each test case is a separate TS project, with a different permutation of
   * project options.  The project is written to disc, then ts-node is installed,
   * then several index-* files are imported to test our resolver.
   *
   * High-level structure of these tests:
   *   package.json, tsconfig.json, src/, and out/
   *   index-* files are the entrypoints
   *   they import a bunch of lib-* files
   *
   * The heart of this test is every time an index-* imports a lib-*.
   * We are testing if the resolver figures out the correct lib-* file to import.
   */
  for (const allowJs of [false, true]) {
    for (const preferSrc of [false, true]) {
      for (const typeModule of [false, true]) {
        for (const experimentalSpecifierResolutionNode of [false, true]) {
          const projectName = `resolver-${
            preferSrc ? 'preferSrc' : 'preferOut'
          }-${typeModule ? 'typeModule' : 'typeCommonjs'}${
            allowJs ? '-allowJs' : ''
          }${
            experimentalSpecifierResolutionNode
              ? '-experimentalSpecifierResolutionNode'
              : ''
          }`;

          test(`${projectName}`, async (t) => {
            t.teardown(() => {
              resetNodeEnvironment();
            });

            const p = project(projectName);
            p.rm();

            p.addJsonFile('package.json', {
              type: typeModule ? 'module' : undefined,
            });
            p.addJsonFile('tsconfig.json', {
              'ts-node': {
                experimentalResolver: true,
                preferSrc,
                transpileOnly: true,
              },
              compilerOptions: {
                allowJs,
                skipLibCheck: true,
              },
            });
            const outDir = p.dir('out');
            const srcDir = p.dir('src');

            //
            // Generate all lib-* files
            //

            /** Array of outDir names, including extension */
            const libFiles: string[] = [];
            // TODO does allowJs matter?
            for (const inOut of [false, true]) {
              for (const inSrc of [false, true]) {
                // Don't bother with src-only extensions when only emitting to `out`
                for (const srcExt of inSrc
                  ? ['ts', 'tsx', 'cts', 'mts', 'js', 'jsx', 'cjs', 'mjs']
                  : ['js', 'cjs', 'mjs']) {
                  const outExt = srcExt.replace('ts', 'js').replace('x', '');
                  const basename = `lib-${
                    inOut && inSrc ? 'inboth' : inOut ? 'onlyout' : 'onlysrc'
                  }-${srcExt}`;
                  const srcName = `${basename}.${srcExt}`;
                  const outName = `${basename}.${outExt}`;
                  libFiles.push(outName);
                  if (inOut) {
                    outDir.addFile(
                      outName,
                      String.raw`console.log(__filename.replace(/.*[\\\/]/, ''), 'out');`
                    );
                  }
                  if (inSrc) {
                    srcDir.addFile(
                      srcName,
                      String.raw`console.log(__filename.replace(/.*[\\\/]/, ''), 'src');`
                    );
                  }
                }
              }
            }

            //
            // Generate all index-* files
            //

            /** Array of index files to be imported during the test */
            let indexFiles: string[] = [];
            for (const indexExt of ['cjs', 'mjs'] as const) {
              for (const withExt of indexExt == 'mjs' &&
              experimentalSpecifierResolutionNode === false
                ? [true]
                : [false, true]) {
                for (const indexLocation of ['src', 'out'] as const) {
                  for (const indexTarget of ['src', 'out'] as const) {
                    if (indexLocation !== indexTarget) continue;

                    const indexFilename = `index-${indexLocation}-to-${indexTarget}${
                      withExt ? '-withext' : ''
                    }.${indexExt}`;
                    let indexContent = '';

                    indexFiles.push(indexLocation + '/' + indexFilename);
                    for (const libFile of libFiles) {
                      const libFileExt = libFile.match(/\.(.*)$/)![1];
                      const libFileIsMjs =
                        (typeModule && libFileExt === 'js') ||
                        libFileExt === 'mjs';

                      let specifier =
                        indexTarget === indexLocation
                          ? './'
                          : `../${indexTarget}/`;
                      specifier += withExt
                        ? libFile
                        : libFile.replace(/\..+$/, '');

                      // Do not try to import mjs from cjs
                      if (libFileIsMjs && indexExt === 'cjs') {
                        indexContent += `// skipping ${specifier} because we cannot import mjs from cjs\n`;
                        continue;
                      }

                      // Do not try to import mjs or cjs without extension; node always requires these extensions, even in CommonJS.
                      if (
                        !withExt &&
                        (libFileExt === 'cjs' || libFileExt === 'mjs')
                      ) {
                        indexContent += `// skipping ${specifier} because we cannot omit extension from cjs or mjs files; node always requires them\n`;
                        continue;
                      }

                      indexContent +=
                        indexExt === 'cjs'
                          ? `require('${specifier}');\n`
                          : `await import('${specifier}');\n`;
                    }
                    p.dir(indexLocation).addFile(indexFilename, indexContent);
                  }
                }
              }
            }
            p.write();

            //
            // Install ts-node and try to import all the index-* files
            //

            t.context.tsNodeUnderTest.register({
              projectSearchDir: p.cwd,
            });

            for (const indexFile of indexFiles) {
              await import(join(p.cwd, indexFile));
            }
          });
        }
      }
    }
  }
});

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
