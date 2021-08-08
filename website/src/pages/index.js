import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

function Feature({imageUrl, title, description}) {
  const imgUrl = useBaseUrl(imageUrl);
  return (
    <div className={clsx('col col--4', styles.feature)}>
      {imgUrl && (
        <div className="text--center">
          <img className={styles.featureImage} src={imgUrl} alt={title} />
        </div>
      )}
    </div>
  );
}

function Home() {
  const context = useDocusaurusContext();
  const {siteConfig = {}} = context;
  return (
    <Layout
      title={siteConfig.title}
      description={siteConfig.tagline}>
      <Head>
        <link rel="apple-touch-icon" sizes="180x180" href="/ts-node/img/favicon/apple-touch-icon.png"/>
        <link rel="icon" type="image/png" sizes="32x32" href="/ts-node/img/favicon/favicon-32x32.png"/>
        <link rel="icon" type="image/png" sizes="16x16" href="/ts-node/img/favicon/favicon-16x16.png"/>
        <link rel="manifest" href="/ts-node/img/favicon/site.webmanifest"/>
        <link rel="mask-icon" href="/ts-node/img/favicon/safari-pinned-tab.svg" color="#5bbad5"/>
        <link rel="shortcut icon" href="/ts-node/img/favicon/favicon.ico"/>
        <meta name="msapplication-TileColor" content="#2b5797"/>
        <meta name="msapplication-config" content="/ts-node/img/favicon/browserconfig.xml"/>
        <meta name="theme-color" content="#ffffff"/>
      </Head>
      <header className={clsx('hero hero--primary', styles.heroBanner)}>
        <div className="container">
          <h1 className="hero__title">{siteConfig.title}</h1>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className={styles.buttons}>
            <Link
              style={{margin: '0 20px'}}
              className={clsx(
                'button button--secondary button--lg',
                styles.getStarted,
              )}
              to={useBaseUrl('docs/')}>
              Get Started
            </Link>
            <iframe
              src={"https://ghbtns.com/github-btn.html?user=TypeStrong&repo=ts-node&type=star&count=true&size=large"}
              frameBorder="0"
              scrolling="0"
              width="160px"
              height="30px"
              style={{ marginTop: '8px' }}
            />
          </div>
        </div>
      </header>
      <main>
        <section className={styles.features}>
          <div className="container">
                <div className="text--center">
                    <img src={useBaseUrl('img/screenshot.png')} alt="screenshot of ts-node" />
                </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default Home;
