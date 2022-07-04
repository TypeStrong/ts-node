module.exports = {
  title: 'ts-node',
  tagline: 'TypeScript execution and REPL for node.js',
  url: 'https://typestrong.org',
  baseUrl: '/ts-node/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon/favicon.ico',
  organizationName: 'TypeStrong', // Usually your GitHub org/user name.
  projectName: 'ts-node', // Usually your repo name.
  themeConfig: {
    image: 'img/opengraph.png',
    // announcementBar: {
    //   id: 'website_wip', // Any value that will identify this message.
    //   content:
    //     '<em>This website is still under construction.  It describes the latest, unreleased changes from our <code>main</code> branch.  Until it is ready, official documentation lives in our <a href="https://github.com/TypeStrong/ts-node#readme">README</a></em>',
    //   //backgroundColor: '#fafbfc', // Defaults to `#fff`.
    //   //textColor: '#091E42', // Defaults to `#000`.
    //   //isCloseable: false, // Defaults to `true`.
    // },
    colorMode: {
      respectPrefersColorScheme: true,
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
          href: 'https://discord.gg/3rBctmf3dP',
          label: 'Chat',
          position: 'right',
        },
        {
          href: 'https://github.com/TypeStrong/ts-node',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    metadata: [
      {
        name: 'msapplication-TileColor',
        content: '#2b5797',
      },
      {
        name: 'msapplication-config',
        content: '/ts-node/img/favicon/browserconfig.xml',
      },
      {
        name: 'theme-color',
        content: '#ffffff',
      },
    ],
    // footer: {
    //   style: 'dark',
    //   links: [
    //     // {
    //     //   title: 'Docs',
    //     //   items: [
    //     //     {
    //     //       label: 'Docs',
    //     //       to: 'docs/',
    //     //     }
    //     //   ],
    //     // },
    //     // {
    //     //   title: 'Community',
    //     //   items: [
    //     //     {
    //     //       label: 'Discord',
    //     //       href: 'https://discord.gg/typescript'
    //     //     },
    //     //     {
    //     //       label: 'Github Discussions',
    //     //       href: 'https://github.com/TypeStrong/ts-node/discussions'
    //     //     },
    //     //   ],
    //     // },
    //     // {
    //     //   title: 'More',
    //     //   items: [
    //     //     {
    //     //       label: 'GitHub',
    //     //       href: 'https://github.com/TypeStrong/ts-node',
    //     //     },
    //     //   ],
    //     // },
    //   ],
    //   // copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
    // },
    prism: {
      // Note: these themes are ignored due to using shiki-twoslash
      theme: require('prism-react-renderer/themes/vsLight'),
      darkTheme: require('prism-react-renderer/themes/vsDark'),
    },
    algolia: {
      appId: 'BYGNLKSCOV',
      apiKey: '74ac2b781b0cf603c2f1b5e4f44e1c69',
      indexName: 'ts-node',
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/TypeStrong/ts-node/edit/docs/website/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
    [
      'docusaurus-preset-shiki-twoslash',
      {
        // https://github.com/shikijs/twoslash/blob/main/packages/shiki-twoslash/README.md#user-settings

        // langs: ["shell", "typescript", "javascript", "ts", "js", "tsx", "jsx", "json", "jsonc"],
        includeJSDocInHover: true,

        themes: ['github-light', 'nord'],

        // VSCode default
        // themes: ["light-plus", "dark-plus"],

        // Other options
        // themes: ["min-light", "nord"],
        // themes: ["min-light", "min-dark"],
        // themes: ["github-light", "github-dark"],
        // themes: ["solarized-light", "solarized-dark"],
      },
    ],
  ],
  // Misleading API that probably will be refactored in Docusaurus, but this is
  // simply a list of <link> tags
  stylesheets: [
    {
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: '/ts-node/img/favicon/apple-touch-icon.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      href: '/ts-node/img/favicon/favicon-32x32.png',
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '16x16',
      href: '/ts-node/img/favicon/favicon-16x16.png',
    },
    {
      rel: 'manifest',
      href: '/ts-node/img/favicon/site.webmanifest',
    },
    {
      rel: 'mask-icon',
      href: '/ts-node/img/favicon/safari-pinned-tab.svg',
      color: '#5bbad5',
    },
    {
      rel: 'shortcut icon',
      href: '/ts-node/img/favicon/favicon.ico',
    },
  ],
};
