/*
 * Render README by merging website's `.md` pages.
 */

const fs = require('fs');
const Path = require('path');
const remark = require('remark');
const remarkFrontmatter = require('remark-frontmatter');
const remarkRecommended = require('remark-preset-lint-recommended');
const remarkToc = require('remark-toc');
const remarkBehead = require('remark-behead');
const jsYaml = require('js-yaml');

const sidebars = require('../website/sidebars.js');

async function main() {
  const children = [];

  await processFile({
    path: 'readme-sources/prefix.md',
    headerLevel: 1,
    reindentLevel: 0
  });

  for(const [, sidebar] of Object.entries(sidebars)) {
    for(const [category, pages] of Object.entries(sidebar)) {
      children.push(headerNode(1, category));
      for(const page of pages) {
        await processFile({
          path: `website/docs/${ page }.md`,
          headerLevel: 2,
          reindentLevel: 1
        });
      }
    }
  }

  processFile({
    path: 'readme-sources/license.md',
    headerLevel: 1,
    reindentLevel: 0
  });

  async function processFile({path, headerLevel, reindentLevel}) {
    const abs = Path.resolve(__dirname, '..', path);
    console.log(path, headerLevel);
    const mdIn = fs.readFileSync(abs, 'utf8');
    await remark()
      .use(remarkFrontmatter, ['yaml'])
      .use(remarkBehead, { after: 0, depth: reindentLevel })
      .use(() => (ast) => {
        let frontmatter;
        if(ast.children[0].type === 'yaml') {
          frontmatter = jsYaml.load(ast.children[0].value);
          ast.children.splice(0, 1);
        }
        if(frontmatter && !frontmatter.omitHeaderOnMerge) {
          children.push(headerNode(headerLevel, frontmatter && frontmatter.title || Path.basename(abs)));
        }
        children.push(...ast.children);
      })
      .process(mdIn);
  }

  const mdMerged = await remark()
    .use(function () {
      return function(ast) {
        ast.children.push(...children);
      }
    })
    .use(remarkToc, {tight: true})
    .use(remarkRecommended)
    .process('');

  fs.writeFileSync(Path.resolve(__dirname, '../README.md'), mdMerged.contents);
}

function headerNode(depth, value) {
  return {
    type: 'heading',
    depth,
    children: [{
      type: 'text',
      value,
      children: []
    }]
  };
}

main();
