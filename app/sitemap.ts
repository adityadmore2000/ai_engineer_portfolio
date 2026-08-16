import type { MetadataRoute } from "next";
import { fallbackProjects } from "@/sanity/fallbackContent";
import { getAllProjects } from "@/sanity/queries";
import type { ProjectSummary } from "@/sanity/types";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const projects = await getAllProjects();
  const sitemapProjects = mergeProjects(projects, fallbackProjects);

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
      }))
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
