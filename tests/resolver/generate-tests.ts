#!/usr/bin/env ts-node

import * as Path from 'path';
import * as fs from 'fs';

for (const allowJs of [false, true]) {
  for (const preferSrc of [false, true]) {
    for (const typeModule of [false, true]) {
      for (const experimentalSpecifierResolutionNode of [false, true]) {
        const projectName = `project${allowJs ? '-allowJs' : ''}-${
          preferSrc ? 'preferSrc' : 'preferOut'
        }-${typeModule ? 'typeModule' : 'typeCommonjs'}${
          experimentalSpecifierResolutionNode ? '-esrn' : ''
        }`;
        const projectDir = Path.join(__dirname, projectName);
        if (fs.existsSync(projectDir)) {
          fs.rmdirSync(projectDir, {
            recursive: true,
          });
        }
        fs.mkdirSync(Path.join(projectDir, 'src'), {
          recursive: true,
        });
        fs.mkdirSync(Path.join(projectDir, 'out'), {
          recursive: true,
        });

        fs.writeFileSync(
          Path.join(projectDir, 'package.json'),
          JSON.stringify(
            {
              type: typeModule ? 'module' : undefined,
            },
            null,
            2
          )
        );
        fs.writeFileSync(
          Path.join(projectDir, 'tsconfig.json'),
          JSON.stringify(
            {
              'ts-node': {
                experimentalResolver: true,
                preferSrc,
                transpileOnly: true,
              },
              compilerOptions: {
                allowJs,
                skipLibCheck: true,
              },
            },
            null,
            2
          )
        );

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
                fs.writeFileSync(
                  Path.join(projectDir, 'out', outName),
                  String.raw`
                  console.log(__filename.replace(/.*[\\\/]/, ''), 'out');
                `
                );
              }
              if (inSrc) {
                fs.writeFileSync(
                  Path.join(projectDir, 'src', srcName),
                  String.raw`
                  console.log(__filename.replace(/.*[\\\/]/, ''), 'src');
                `
                );
              }
            }
          }
        }
        for (const indexExt of ['cjs', 'mjs'] as const) {
          for (const withExt of indexExt == 'mjs' &&
          experimentalSpecifierResolutionNode === false
            ? [true]
            : [false, true]) {
            for (const indexLocation of ['src', 'out'] as const) {
              for (const indexTarget of ['src', 'out'] as const) {
                const indexFilename = `index-${indexLocation}-to-${indexTarget}${
                  withExt ? '-withext' : ''
                }.${indexExt}`;
                fs.writeFileSync(
                  Path.join(projectDir, indexLocation, indexFilename),
                  `
                  ${libFiles
                    .map((libFile) => {
                      const libFileExt = libFile.match(/\.(.*)$/)![1];
                      const libFileIsMjs =
                        (typeModule && libFileExt === 'js') ||
                        libFileExt === 'mjs';
                      // Do not try to import mjs from cjs
                      if (libFileIsMjs && indexExt === 'cjs') return '';
                      const specifier = `${
                        indexTarget === indexLocation
                          ? './'
                          : `../${indexTarget}`
                      }${withExt ? libFile : libFile.replace(/\..+$/, '')}`;
                      return `${
                        indexExt === 'cjs'
                          ? `require('${specifier}');`
                          : `await import('${specifier}');`
                      }`;
                    })
                    .join('\n')}
                `
                );
              }
            }
          }
        }
      }
    }
  }
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
