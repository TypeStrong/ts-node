#!/usr/bin/env node
/*
 * Render README by merging website's `.md` pages.
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import Path from 'path';

import _ from 'lodash';
import remark from 'remark';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRecommended from 'remark-preset-lint-recommended';
import remarkToc from 'remark-toc';
import remarkBehead from 'remark-behead';
import remarkValidateLinks from 'remark-validate-links';
import visit from 'unist-util-visit';
import vfile from 'vfile';
import vfileReporter from 'vfile-reporter';
import jsYaml from 'js-yaml';

const __websiteRoot = Path.resolve(fileURLToPath(import.meta.url), '../..');
const __root = Path.resolve(__websiteRoot, '..');
const readmePath = Path.resolve(__root, 'README.md');
const generateReadmeHeadersForCategories = {
  General: false,
  Advanced: true,
  Recipes: true,
};

import sidebars from '../sidebars.js';

async function main() {
  const readmeNodes = [];

  await appendMarkdownFileToReadmeAst({
    path: 'readme-sources/prefix.md',
    headerLevel: 1,
  });

  const sidebar = sidebars.primarySidebar;
  for (const category of sidebar) {
    const generateReadmeHeader = generateReadmeHeadersForCategories[category.label];
    if (generateReadmeHeader) {
      readmeNodes.push(headerNode(1, category.label));
    } else if (generateReadmeHeader == null) {
      throw new Error(`Update ${import.meta.url} to include all sidebar categories`);
    }
    for (const page of category.items) {
      await appendMarkdownFileToReadmeAst({
        path: `docs/${page}.md`,
        headerLevel: 1 + !!generateReadmeHeader,
      });
    }
  }

  appendMarkdownFileToReadmeAst({
    path: 'readme-sources/license.md',
    headerLevel: 1,
  });

  async function appendMarkdownFileToReadmeAst({ path, headerLevel }) {
    const absPath = Path.resolve(__websiteRoot, path);
    console.log(`Appending ${path} at header level ${headerLevel}`);
    const markdownSource = fs.readFileSync(absPath, 'utf8');
    await remark()
      .use(remarkFrontmatter, ['yaml'])
      .use(parseFrontmatter)
      .use(remarkBehead, { after: '', depth: headerLevel - 1 })
      .use(() => (ast) => {
        const { frontmatter } = ast;
        if (frontmatter && !frontmatter.omitHeaderOnMerge) {
          readmeNodes.push(headerNode(headerLevel, (frontmatter && frontmatter.title) || Path.basename(absPath)));
        }
        readmeNodes.push(...ast.children);
      })
      .process(markdownSource);
  }

  const renderedReadme = await remark()
    .use(() => (ast) => {
      ast.children.push(...readmeNodes);
    })
    .use(codeLanguageJsonToJsonc)
    .use(rewritePageLinksToAnchorLinks)
    .use(rewriteImgTargets)
    .use(trimCutFromTwoslashCode)
    .use(remarkToc, { tight: true })
    .process(
      vfile({
        path: readmePath,
        contents: '',
      })
    );

  fs.writeFileSync(readmePath, renderedReadme.contents);

  console.error(vfileReporter(renderedReadme));
  if (renderedReadme.messages.length) throw new Error('Aborting on diagnostics.');
  const lintResults = await remark().use(remarkValidateLinks).use(remarkRecommended).process(renderedReadme);
  console.error(vfileReporter(lintResults));
  if (lintResults.messages.length) throw new Error('Aborting on diagnostics.');
}

function parseFrontmatter() {
  return (ast) => {
    if (ast.children[0].type === 'yaml') {
      ast.frontmatter = jsYaml.load(ast.children[0].value);
      ast.children.splice(0, 1);
    }
  };
}

function codeLanguageJsonToJsonc() {
  return (ast) => {
    visit(ast, 'code', (node) => {
      if (node.lang === 'json') node.lang = 'jsonc';
    });
  };
}
function rewritePageLinksToAnchorLinks() {
  return (ast) => {
    visit(ast, 'link', (node) => {
      if (node.url?.match?.(/^https?\:\/\//)) return;
      // TODO take page title into account
      node.url = node.url.replace(/^[\.\/]*(?:recipes\/)?(?:([^#]+)|.*#(.*))$/, '#$1$2');
      node.url = node.url.replace(/\.md$/, '');
    });
  };
}

function rewriteImgTargets() {
  return (ast) => {
    visit(ast, 'image', (node) => {
      node.url = node.url.replace(/^\//, 'website/static/');
    });
  };
}

function trimCutFromTwoslashCode() {
  return (ast) => {
    // Strip everything above // ---cut--- in twoslash code blocks
    const lookingFor = '\n// ---cut---\n';
    visit(ast, 'code', (node) => {
      if (node.meta?.includes('twoslash') && node.value.includes(lookingFor)) {
        node.value = node.value.slice(node.value.lastIndexOf(lookingFor) + lookingFor.length);
      }
    });
  };
}

function headerNode(depth, value) {
  return {
    type: 'heading',
    depth,
    children: [
      {
        type: 'text',
        value,
        children: [],
      },
    ],
  };
}

try {
  await main();
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
