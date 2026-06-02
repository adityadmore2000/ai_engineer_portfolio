import type { MetadataRoute } from "next";
import { getAllProjects, getAllTechnicalNotes } from "@/sanity/queries";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const [projects, notes] = await Promise.all([
    getAllProjects(),
    getAllTechnicalNotes()
  ]);

  return [
    {
      url: siteUrl,
      lastModified: new Date()
    },
    ...projects
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
      }))
  ];
}
