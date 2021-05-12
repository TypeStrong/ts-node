module.exports = {
  primarySidebar: [{
    type: 'category',
    label: 'General',
    collapsed: false,
    items: [
      'overview',
      'installation',
      'usage',
      'configuration',
      'imports',
      'troubleshooting',
      'performance',
    ]
  }, {
    type: 'category',
    label: 'Advanced',
    collapsed: false,
    items: [
      'how-it-works',
      'paths',
      'types',
      'compilers',
      'transpilers'
    ],
  }, {
    type: 'category',
    label: 'Recipes',
    collapsed: false,
    items: [
      'recipes/watching-and-restarting',
      'recipes/ava',
      'recipes/gulp',
      'recipes/intellij',
      'recipes/mocha',
      'recipes/tape',
      'recipes/visual-studio-code',
      'recipes/other'
    ]
  }],
};
