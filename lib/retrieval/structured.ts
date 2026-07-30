import { client } from "@/sanity/client";
import { groq } from "next-sanity";
import type { SearchResult } from "./types";

type SanityDoc = Record<string, unknown>;

function toSearchResult(
  project: SanityDoc,
  section: string,
  content: string
): SearchResult {
  return {
    content,
    projectTitle: project.title as string,
    slug: (project.slug as string) ?? undefined,
    section,
    url: project.slug ? `/projects/${project.slug}` : undefined,
  };
}

function extractProjectFields(project: SanityDoc): SearchResult[] {
  const results: SearchResult[] = [];
  const title = project.title as string;

  if (project.shortSummary) {
    results.push(
      toSearchResult(project, "Short Summary", project.shortSummary as string)
    );
  }
  if (project.whyIBuiltIt) {
    results.push(
      toSearchResult(project, "Why I Built It", project.whyIBuiltIt as string)
    );
  }
  if (project.theProblem) {
    results.push(
      toSearchResult(project, "The Problem", project.theProblem as string)
    );
  }
  if (project.theSolution) {
    results.push(toSearchResult(project, "The Solution", project.theSolution as string));
  }
  if (project.engineeringDecisions) {
    results.push(
      toSearchResult(project, "Engineering Decisions", project.engineeringDecisions as string)
    );
  }
  if (project.whatThisDemonstrates) {
    results.push(
      toSearchResult(project, "What This Demonstrates", project.whatThisDemonstrates as string)
    );
  }
  if (project.results) {
    results.push(toSearchResult(project, "Results", project.results as string));
  }
  if (project.limitations) {
    results.push(
      toSearchResult(project, "Limitations", project.limitations as string)
    );
  }
  if (project.futureImprovements) {
    results.push(
      toSearchResult(project, "Future Improvements", project.futureImprovements as string)
    );
  }
  if (project.technologies) {
    results.push(
      toSearchResult(
        project,
        "Technologies",
        `${title} uses: ${(project.technologies as string[]).join(", ")}`
      )
    );
  }
  if (project.keyMetrics) {
    results.push(
      toSearchResult(
        project,
        "Key Metrics",
        `${title} outcomes: ${(project.keyMetrics as string[]).join(", ")}`
      )
    );
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
      whyIBuiltIt,
      theProblem,
      theSolution,
      engineeringDecisions,
      results,
      whatThisDemonstrates,
      limitations,
      futureImprovements
    }
  `;

  const projects = await client.fetch<SanityDoc[]>(query, { tech });
  if (!projects?.length) return [];

  return projects.flatMap(extractProjectFields);
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
      whyIBuiltIt,
      theProblem,
      theSolution,
      engineeringDecisions,
      results,
      whatThisDemonstrates,
      limitations,
      futureImprovements
    }
  `;

  const project = await client.fetch<SanityDoc>(query, { slug });
  if (!project) return [];

  return extractProjectFields(project);
}
