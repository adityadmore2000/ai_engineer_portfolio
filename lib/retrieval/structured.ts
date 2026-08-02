import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import type { PortableTextBlock } from "next-sanity";
import { splitSectionsByHeading } from "@/lib/content/portable-text";
import type { SearchResult } from "./types";

type SanityDoc = Record<string, unknown>;

const metadataSectionAnchor: Record<string, string> = {
  "Short Summary": "short-summary",
  Technologies: "technologies",
  "Key Metrics": "key-metrics",
};

/**
 * Build SearchResults for a project doc from its `content` Portable Text,
 * deriving sections from the document structure by heading. No assumption of
 * predefined section names (no "Engineering Decisions" / "Results" field
 * reads). Tech/metrics/short-summary summaries come from unchanged metadata.
 */
function projectToSearchResults(project: SanityDoc): SearchResult[] {
  const results: SearchResult[] = [];
  const title = project.title as string;
  const slug = (project.slug as string) || undefined;
  const projectUrl = slug ? `/projects/${slug}` : undefined;

  if (project.shortSummary) {
    results.push({
      content: project.shortSummary as string,
      projectTitle: title,
      slug,
      section: "Short Summary",
      url: projectUrl ? `${projectUrl}#${metadataSectionAnchor["Short Summary"]}` : undefined,
    });
  }

  const content = project.content as PortableTextBlock[] | undefined;
  if (Array.isArray(content)) {
    const sections = splitSectionsByHeading(content);

    for (const section of sections) {
      if (!section.text) continue;
      results.push({
        content: section.text,
        projectTitle: title,
        slug,
        section: section.heading || "Overview",
        url:
          projectUrl && section.id ? `${projectUrl}#${section.id}` : projectUrl,
      });
    }
  }

  if (Array.isArray(project.technologies) && project.technologies.length) {
    results.push({
      content: `${title} uses: ${(project.technologies as string[]).join(", ")}`,
      projectTitle: title,
      slug,
      section: "Technologies",
      url: projectUrl ? `${projectUrl}#${metadataSectionAnchor.Technologies}` : undefined,
    });
  }

  if (Array.isArray(project.keyMetrics) && project.keyMetrics.length) {
    results.push({
      content: `${title} outcomes: ${(project.keyMetrics as string[]).join(", ")}`,
      projectTitle: title,
      slug,
      section: "Key Metrics",
      url: projectUrl ? `${projectUrl}#${metadataSectionAnchor["Key Metrics"]}` : undefined,
    });
  }

  return results;
}

export async function searchByTechnology(tech: string): Promise<SearchResult[]> {
  const query = groq`
    *[_type == "project" && published == true && $tech in technologies] {
      title,
      "slug": slug.current,
      shortSummary,
      technologies,
      keyMetrics,
      content
    }
  `;

  const projects = await client.fetch<SanityDoc[]>(query, { tech });
  if (!projects?.length) return [];

  return projects.flatMap(projectToSearchResults);
}

export async function getContactInfo(): Promise<SearchResult[]> {
  const query = groq`
    *[_type == "siteSettings"][0] {
      name,
      role,
      email,
      linkedinUrl,
      githubUrl,
      resumeUrl,
      resumeFile{ "url": asset->url },
      location,
      availabilityText,
      aboutSummary,
      focusAreas,
      shortBio,
      contactHeadline,
      contactDescription
    }
  `;

  const settings = await client.fetch<SanityDoc>(query);
  if (!settings) return [];

  const results: SearchResult[] = [];
  const name = settings.name as string;

  if (settings.email) {
    results.push({
      content: `Email: ${settings.email}`,
      projectTitle: name,
      section: "Contact",
    });
  }
  if (settings.linkedinUrl) {
    results.push({
      content: `LinkedIn: ${settings.linkedinUrl}`,
      projectTitle: name,
      section: "Contact",
    });
  }
  if (settings.githubUrl) {
    results.push({
      content: `GitHub: ${settings.githubUrl}`,
      projectTitle: name,
      section: "Contact",
    });
  }
  if (settings.resumeUrl || (settings.resumeFile as { url?: string } | undefined)?.url) {
    const url =
      (settings.resumeFile as { url?: string } | undefined)?.url ||
      (settings.resumeUrl as string);
    results.push({
      content: `Resume: ${url}`,
      projectTitle: name,
      section: "Resume",
      url,
    });
  }
  if (settings.aboutSummary) {
    results.push({
      content: settings.aboutSummary as string,
      projectTitle: name,
      section: "About",
    });
  }
  if (settings.shortBio) {
    results.push({
      content: settings.shortBio as string,
      projectTitle: name,
      section: "Bio",
    });
  }
  if (settings.focusAreas) {
    results.push({
      content: `Focus areas: ${(settings.focusAreas as string[]).join(", ")}`,
      projectTitle: name,
      section: "Focus Areas",
    });
  }

  return results;
}

export async function getExperience(): Promise<SearchResult[]> {
  const query = groq`
    *[_type == "experience"] | order(coalesce(displayOrder, 999) asc, startDate desc) {
      role,
      company,
      location,
      startDate,
      endDate,
      currentRole,
      shortDescription,
      bulletPoints,
      skills
    }
  `;

  const items = await client.fetch<SanityDoc[]>(query);
  if (!items?.length) return [];

  return items.map((item) => {
    const role = item.role as string;
    const company = item.company as string;
    const dateRange = `${item.startDate || ""} – ${item.currentRole ? "Present" : item.endDate || ""}`;
    const bullets = (item.bulletPoints as string[] | undefined)?.map(
      (b) => `- ${b}`
    ).join("\n") || "";
    const skills = (item.skills as string[] | undefined)?.join(", ") || "";

    return {
      content: [
        `**${role}** at **${company}**`,
        dateRange,
        item.shortDescription ? `\n${item.shortDescription}` : "",
        bullets ? `\n${bullets}` : "",
        skills ? `\nSkills: ${skills}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      projectTitle: `${role} @ ${company}`,
      section: "Experience",
    };
  });
}

export async function getSkills(): Promise<SearchResult[]> {
  const query = groq`
    *[_type == "skillCategory"] | order(coalesce(displayOrder, 999) asc, title asc) {
      title,
      skills
    }
  `;

  const categories = await client.fetch<SanityDoc[]>(query);
  if (!categories?.length) return [];

  return categories.map((cat) => ({
    content: `**${cat.title as string}**: ${(cat.skills as string[]).join(", ")}`,
    section: "Skills",
  }));
}

export async function getResumeUrl(): Promise<string | null> {
  const query = groq`
    *[_type == "siteSettings"][0] {
      resumeUrl,
      resumeFile{ "url": asset->url }
    }
  `;

  const settings = await client.fetch<SanityDoc>(query);
  if (!settings) return null;

  return (
    ((settings.resumeFile as { url?: string } | undefined)?.url as string) ||
    (settings.resumeUrl as string) ||
    null
  );
}

export async function getProjectBySlugFromSanity(slug: string): Promise<SearchResult[]> {
  const query = groq`
    *[_type == "project" && slug.current == $slug && published == true][0] {
      title,
      "slug": slug.current,
      shortSummary,
      technologies,
      keyMetrics,
      content
    }
  `;

  const project = await client.fetch<SanityDoc>(query, { slug });
  if (!project) return [];

  return projectToSearchResults(project);
}
