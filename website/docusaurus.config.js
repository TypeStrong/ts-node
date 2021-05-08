module.exports = {
  title: 'ts-node',
  tagline: 'TypeScript execution and REPL for node.js',
  url: 'https://typestrong.org/ts-node',
  baseUrl: '/ts-node/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'TypeStrong', // Usually your GitHub org/user name.
  projectName: 'ts-node', // Usually your repo name.
  themeConfig: {
    image: 'img/opengraph.png',
    announcementBar: {
      id: 'website_wip', // Any value that will identify this message.
      content:
        '<em>This website is still under construction.  It describes the latest, unreleased changes from our <code>main</code> branch.  Until it is ready, official documentation lives in our <a href="https://github.com/TypeStrong/ts-node#readme">README</a></em>',
      //backgroundColor: '#fafbfc', // Defaults to `#fff`.
      //textColor: '#091E42', // Defaults to `#000`.
      //isCloseable: false, // Defaults to `true`.
    },
    colorMode: {
      respectPrefersColorScheme: true
    },
    navbar: {
      title: 'ts-node',
      logo: {
        alt: 'ts-node logo',
        src: 'img/logo-icon.svg',
      },
      items: [
        {
          to: 'docs/',
          activeBasePath: 'docs',
          label: 'Docs',
          position: 'right',
        },
        {
          href: 'https://typestrong.org/ts-node/api/',
          label: 'API',
          position: 'right',
        },
        {
          href: 'https://github.com/TypeStrong/ts-node/releases',
          label: 'Release Notes',
          position: 'right',
        },
        {
          href: 'https://github.com/TypeStrong/ts-node/discussions',
          label: 'Discuss',
          position: 'right',
        },
        {
          href: 'https://github.com/TypeStrong/ts-node',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Docs',
              to: 'docs/',
            }
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discord',
              href: 'https://discord.gg/typescript'
            },
            {
              label: 'Github Discussions',
              href: 'https://github.com/TypeStrong/ts-node/discussions'
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/TypeStrong/ts-node',
            },
          ],
        },
      ],
      // copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
    },
    prism: {
      // for syntax highlighting
      // additionalLanguages: ['powershell'],
    },
    algolia: {
      apiKey: 'c882a0a136ef4e15aa99db604280caa6',
      indexName: 'ts-node',

      // Optional: see doc section below
      // contextualSearch: true,

      // Optional: see doc section below
      // appId: 'YOUR_APP_ID',

      // Optional: Algolia search parameters
      // searchParameters: {},

      //... other Algolia params
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl:
            'https://github.com/TypeStrong/ts-node/edit/docs/website/',
        },
        // blog: {
        //   showReadingTime: true,
        //   // Please change this to your repo.
        //   editUrl:
        //     'https://github.com/facebook/docusaurus/edit/master/website/blog/',
        // },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
