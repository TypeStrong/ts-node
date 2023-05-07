// Change: HomeBreadcrumbItem points to /docs instead of /

import React, { type ReactNode } from 'react';
import { ThemeClassNames, useSidebarBreadcrumbs, useHomePageRoute } from '@docusaurus/theme-common';
import styles from './styles.module.css';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';

function BreadcrumbsItemLink({ children, href }: { children: ReactNode; href?: string }): JSX.Element {
  const className = clsx('breadcrumbs__link', styles.breadcrumbsItemLink);
  return href ? (
    <Link className={className} href={href}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

function BreadcrumbsItem({ children, active }: { children: ReactNode; active?: boolean }): JSX.Element {
  return (
    <li
      className={clsx('breadcrumbs__item', {
        'breadcrumbs__item--active': active,
      })}
    >
      {children}
    </li>
  );
}

function HomeBreadcrumbItem() {
  const homeHref = useBaseUrl('/docs');
  return (
    <BreadcrumbsItem>
      <BreadcrumbsItemLink href={homeHref}>🏠</BreadcrumbsItemLink>
    </BreadcrumbsItem>
  );
}

export default function DocBreadcrumbs(): JSX.Element | null {
  const breadcrumbs = useSidebarBreadcrumbs();
  const homePageRoute = useHomePageRoute();

  if (!breadcrumbs) {
    return null;
  }

  return (
    <nav className={clsx(ThemeClassNames.docs.docBreadcrumbs, styles.breadcrumbsContainer)} aria-label="breadcrumbs">
      <ul className="breadcrumbs">
        {homePageRoute && <HomeBreadcrumbItem />}
        {breadcrumbs.map((item, idx) => (
          <BreadcrumbsItem key={idx} active={idx === breadcrumbs.length - 1}>
            <BreadcrumbsItemLink href={item.href}>{item.label}</BreadcrumbsItemLink>
          </BreadcrumbsItem>
        ))}
      </ul>
    </nav>
  );
}
