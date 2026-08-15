import { Document } from "@langchain/core/documents";
import type {
  SanityExperience,
  SanityProject,
  SanitySiteSettings,
  SanitySkillCategory,
  SanityTechnicalNote,
} from "./types";

export function chunkProject(project: SanityProject, baseUrl: string): Document[] {
  const docs: Document[] = [];
  const slug = project.slug || "";
  const projectUrl = slug ? `${baseUrl}/projects/${slug}` : baseUrl;

  if (project.shortSummary) {
    docs.push(
      new Document({
        pageContent: project.shortSummary,
        metadata: {
          projectTitle: project.title,
          slug,
          section: "Short Summary",
          url: projectUrl,
        },
      })
    );
  }

  for (const section of project.sections || []) {
    if (!section.description) continue;
    docs.push(
      new Document({
        pageContent: section.description,
        metadata: {
          projectTitle: project.title,
          slug,
          section: section.title,
          url: `${projectUrl}#${section.title.toLowerCase().replace(/\s+/g, "-")}`,
        },
      })
    );
  }

  if (project.technologies?.length) {
    docs.push(
      new Document({
        pageContent: `Technologies used in ${project.title}: ${project.technologies.join(", ")}`,
        metadata: {
          projectTitle: project.title,
          slug,
          section: "Technologies",
          url: `${projectUrl}#technologies`,
        },
      })
    );
  }

  return docs;
}

export function chunkSiteSettings(settings: SanitySiteSettings, baseUrl: string): Document[] {
  const docs: Document[] = [];

  if (settings.shortBio) {
    docs.push(
      new Document({
        pageContent: settings.shortBio,
        metadata: { section: "Bio", url: `${baseUrl}/#home` },
      })
    );
  }

  if (settings.aboutSummary) {
    docs.push(
      new Document({
        pageContent: settings.aboutSummary,
        metadata: { section: "About", url: `${baseUrl}/#about` },
      })
    );
  }

  if (settings.heroDescription) {
    docs.push(
      new Document({
        pageContent: settings.heroDescription,
        metadata: { section: "Hero Description", url: `${baseUrl}/#home` },
      })
    );
  }

  if (settings.focusAreas?.length) {
    docs.push(
      new Document({
        pageContent: `Focus areas: ${settings.focusAreas.join(", ")}`,
        metadata: { section: "Focus Areas", url: `${baseUrl}/#about` },
      })
    );
  }

  if (settings.contactDescription) {
    docs.push(
      new Document({
        pageContent: settings.contactDescription,
        metadata: { section: "Contact", url: `${baseUrl}/#contact` },
      })
    );
  }

  return docs;
}

export function chunkExperience(exp: SanityExperience, baseUrl: string): Document[] {
  const role = exp.role || "Role";
  const company = exp.company || "Company";
  const bullets = exp.bulletPoints?.length
    ? `\n${exp.bulletPoints.map((b) => `- ${b}`).join("\n")}`
    : "";
  const skills = exp.skills?.length ? `\nSkills: ${exp.skills.join(", ")}` : "";

  return [
    new Document({
      pageContent: [
        `${role} at ${company}`,
        exp.shortDescription,
        bullets || undefined,
        skills || undefined,
      ]
        .filter(Boolean)
        .join("\n"),
      metadata: {
        section: "Experience",
        url: `${baseUrl}/#experience`,
      },
    }),
  ];
}

export function chunkSkillCategory(cat: SanitySkillCategory, baseUrl: string): Document[] {
  return [
    new Document({
      pageContent: `${cat.title || "Category"}: ${(cat.skills || []).join(", ")}`,
      metadata: {
        section: "Skills",
        url: `${baseUrl}/#skills`,
      },
    }),
  ];
}

export function chunkTechnicalNote(note: SanityTechnicalNote, baseUrl: string): Document[] {
  const slug = note.slug || "";
  const noteUrl = slug ? `${baseUrl}/notes/${slug}` : baseUrl;
  const docs: Document[] = [];

  if (note.shortSummary) {
    docs.push(
      new Document({
        pageContent: note.shortSummary,
        metadata: {
          section: "Short Summary",
          title: note.title,
          slug,
          url: noteUrl,
        },
      })
    );
  }

  if (note.tags?.length) {
    docs.push(
      new Document({
        pageContent: `Tags: ${note.tags.join(", ")}`,
        metadata: {
          section: "Tags",
          title: note.title,
          slug,
          url: noteUrl,
        },
      })
    );
  }

  return docs;
}
