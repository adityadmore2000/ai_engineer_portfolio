import type { MetadataRoute } from "next";
import { createProjectDocsSource } from "@/lib/project-docs-source";
import { fallbackProjects } from "@/sanity/fallbackContent";
import {
  getAllProjectDocumentationPages,
  getAllProjects,
  getAllTechnicalNotes
} from "@/sanity/queries";
import type { ProjectSummary } from "@/sanity/types";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const [projects, notes, documentationPages] = await Promise.all([
    getAllProjects(),
    getAllTechnicalNotes(),
    getAllProjectDocumentationPages()
  ]);
  const sitemapProjects = mergeProjects(projects, fallbackProjects);
  const documentationUrls = sitemapProjects.flatMap((project) => {
    if (!project.slug) {
      return [];
    }

    const source = createProjectDocsSource({
      project,
      pages: documentationPages,
      docSlug: []
    });

    return source.pages.map((page) => ({
      url: `${siteUrl}${page.url}`,
      lastModified: new Date()
    }));
  });

  return [
    {
      url: siteUrl,
      lastModified: new Date()
    },
    ...sitemapProjects
      .filter((project) => project.slug)
      .map((project) => ({
        url: `${siteUrl}/projects/${project.slug}`,
        lastModified: new Date()
      })),
    ...notes
      .filter((note) => note.slug)
      .map((note) => ({
        url: `${siteUrl}/notes/${note.slug}`,
        lastModified: note.publishedDate ? new Date(note.publishedDate) : new Date()
      })),
    ...dedupeSitemapEntries(documentationUrls)
  ];
}

function mergeProjects(
  sanityProjects: ProjectSummary[],
  localFallbackProjects: ProjectSummary[]
) {
  const bySlug = new Map<string, ProjectSummary>();

  for (const project of [...localFallbackProjects, ...sanityProjects]) {
    if (project.slug) {
      bySlug.set(project.slug, project);
    }
  }

  return [...bySlug.values()];
}

function dedupeSitemapEntries(entries: MetadataRoute.Sitemap) {
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}
