module.exports = {
  primarySidebar: [{
    type: 'category',
    label: 'General',
    collapsed: false,
    items: [
      'getting-started',
      'how-it-works',
      'usage',
      'configuration',
      'imports',
      'shebang',
      'errors',
    ]
  }, {
    type: 'category',
    label: 'Advanced',
    collapsed: false,
    items: [
      'paths',
      'types',
      'transpilers'
    ],
  }, {
    type: 'category',
    label: 'Recipes',
    collapsed: false,
    items: [
      'recipes/watching-and-restarting',
      'recipes/mocha',
      'recipes/gulp',
      'recipes/visual-studio-code',
      'recipes/ava',
      'recipes/intellij',
      'recipes/other'
    ]
  }],
};
