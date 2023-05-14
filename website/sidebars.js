module.exports = {
  primarySidebar: [
    {
      type: 'category',
      label: 'General',
      collapsed: false,
      items: [
        'overview',
        'installation',
        'usage',
        'configuration',
        'options',
        'swc',
        'commonjs-vs-native-ecmascript-modules',
        'troubleshooting',
        'performance',
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      collapsed: false,
      items: ['how-it-works', 'scope', 'paths', 'compilers', 'transpilers', 'module-type-overrides', 'api'],
    },
    {
      type: 'category',
      label: 'Recipes',
      collapsed: false,
      items: [
        'recipes/watching-and-restarting',
        // 'recipes/npx-and-yarn-dlx',
        'recipes/ava',
        'recipes/gulp',
        'recipes/intellij',
        'recipes/mocha',
        'recipes/tape',
        'recipes/visual-studio-code',
        'recipes/other',
      ],
    },
  ],
  hiddenSidebar: [
    {
      type: 'category',
      label: 'Hidden pages',
      collapsed: false,
      items: ['options-table'],
    },
  ],
};
