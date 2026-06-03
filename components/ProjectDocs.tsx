import type { ReactNode } from "react";
import type { Root } from "fumadocs-core/page-tree";
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
  toc?: TOCItemType[];
  children: ReactNode;
};

export function ProjectDocsPage({
  title,
  description,
  toc,
  children
}: ProjectDocsPageProps) {
  return (
    <DocsPage
      toc={toc}
      breadcrumb={{ enabled: false }}
      footer={{ enabled: false }}
    >
      <DocsTitle>{title}</DocsTitle>
      {description ? <DocsDescription>{description}</DocsDescription> : null}
      <DocsBody>{children}</DocsBody>
    </DocsPage>
  );
}
