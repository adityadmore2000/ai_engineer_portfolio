import type { ReactNode } from "react";
import type { Item, Root } from "fumadocs-core/page-tree";
import type { TOCItemType } from "fumadocs-core/toc";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle
} from "fumadocs-ui/page";

export type ProjectDocsLayoutProps = {
  tree: Root;
  children: ReactNode;
};

export function ProjectDocsLayout({
  tree,
  children
}: ProjectDocsLayoutProps) {
  return (
    <DocsLayout
      tree={tree}
      nav={{ enabled: false }}
      searchToggle={{ enabled: false }}
      themeSwitch={{ enabled: false }}
      sidebar={{ tabs: false }}
    >
      {children}
    </DocsLayout>
  );
}

export type ProjectDocsPageProps = {
  title: ReactNode;
  description?: ReactNode;
  statusLabel?: string;
  toc?: TOCItemType[];
  previous?: Item;
  next?: Item;
  children: ReactNode;
};

export function ProjectDocsPage({
  title,
  description,
  statusLabel,
  toc,
  previous,
  next,
  children
}: ProjectDocsPageProps) {
  return (
    <DocsPage
      toc={toc}
      breadcrumb={{ includeRoot: true, includePage: true }}
      footer={{ items: { previous, next } }}
    >
      {statusLabel ? (
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-teal-800">
          {statusLabel}
        </p>
      ) : null}
      <DocsTitle>{title}</DocsTitle>
      {description ? <DocsDescription>{description}</DocsDescription> : null}
      <DocsBody>{children}</DocsBody>
    </DocsPage>
  );
}
