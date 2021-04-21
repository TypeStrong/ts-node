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
          position: 'left',
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
