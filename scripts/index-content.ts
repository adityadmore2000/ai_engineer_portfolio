import "./load-env";
import { groq } from "next-sanity";
import { client } from "../sanity/client";
import { isSanityConfigured } from "../sanity/env";
import {
  fallbackSiteSettings,
  fallbackExperiences,
  fallbackProjects,
  fallbackSkillCategories,
} from "../sanity/fallbackContent";
import { getEmbeddings } from "../lib/ai/embeddings";
import { QdrantVectorStore } from "@langchain/qdrant";
import { Document } from "@langchain/core/documents";

type SanityProject = {
  _id: string;
  title: string;
  slug: string | null;
  shortSummary: string | null;
  problemStatement: string | null;
  approach: string | null;
  results: string | null;
  limitations: string | null;
  futureImprovements: string | null;
  technologies: string[] | null;
  keyMetrics: string[] | null;
};

type SanitySiteSettings = {
  name: string | null;
  shortBio: string | null;
  aboutSummary: string | null;
  focusAreas: string[] | null;
  contactHeadline: string | null;
  contactDescription: string | null;
  heroDescription: string | null;
};

type SanityExperience = {
  _id: string;
  role: string | null;
  company: string | null;
  shortDescription: string | null;
  bulletPoints: string[] | null;
  skills: string[] | null;
};

type SanitySkillCategory = {
  _id: string;
  title: string | null;
  skills: string[] | null;
};

type SanityTechnicalNote = {
  _id: string;
  title: string | null;
  slug: string | null;
  shortSummary: string | null;
  tags: string[] | null;
};

function fallbackToSanityProject(
  fb: (typeof fallbackProjects)[number]
): SanityProject {
  return {
    _id: fb._id,
    title: fb.title,
    slug: fb.slug || null,
    shortSummary: fb.shortSummary || null,
    problemStatement: fb.problemStatement || null,
    approach: fb.approach || null,
    results: fb.results || null,
    limitations: fb.limitations || null,
    futureImprovements: fb.futureImprovements || null,
    technologies: fb.technologies || null,
    keyMetrics: fb.keyMetrics || null,
  };
}

function fallbackToSanitySiteSettings(
  fb: typeof fallbackSiteSettings
): SanitySiteSettings {
  return {
    name: fb.name || null,
    shortBio: fb.shortBio || null,
    aboutSummary: fb.aboutSummary || null,
    focusAreas: fb.focusAreas || null,
    contactHeadline: fb.contactHeadline || null,
    contactDescription: fb.contactDescription || null,
    heroDescription: fb.heroDescription || null,
  };
}

function fallbackToSanityExperience(
  fb: (typeof fallbackExperiences)[number]
): SanityExperience {
  return {
    _id: fb._id,
    role: fb.role || null,
    company: fb.company || null,
    shortDescription: fb.shortDescription || null,
    bulletPoints: fb.bulletPoints || null,
    skills: fb.skills || null,
  };
}

function fallbackToSanitySkillCategory(
  fb: (typeof fallbackSkillCategories)[number]
): SanitySkillCategory {
  return {
    _id: fb._id,
    title: fb.title || null,
    skills: fb.skills || null,
  };
}

function chunkProject(project: SanityProject, baseUrl: string): Document[] {
  const docs: Document[] = [];
  const slug = project.slug || "";
  const projectUrl = slug ? `${baseUrl}/projects/${slug}` : baseUrl;

  const sections: { name: string; content: string }[] = [
    { name: "Short Summary", content: project.shortSummary || "" },
    { name: "Problem Statement", content: project.problemStatement || "" },
    { name: "Approach", content: project.approach || "" },
    { name: "Results", content: project.results || "" },
    { name: "Limitations", content: project.limitations || "" },
    { name: "Future Improvements", content: project.futureImprovements || "" },
  ];

  for (const section of sections) {
    if (!section.content) continue;
    docs.push(
      new Document({
        pageContent: section.content,
        metadata: {
          projectTitle: project.title,
          slug,
          section: section.name,
          url: `${projectUrl}#${section.name.toLowerCase().replace(/\s+/g, "-")}`,
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

  if (project.keyMetrics?.length) {
    docs.push(
      new Document({
        pageContent: `Key metrics for ${project.title}: ${project.keyMetrics.join(", ")}`,
        metadata: {
          projectTitle: project.title,
          slug,
          section: "Key Metrics",
          url: `${projectUrl}#key-metrics`,
        },
      })
    );
  }

  return docs;
}

function chunkSiteSettings(settings: SanitySiteSettings, baseUrl: string): Document[] {
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

function chunkExperience(exp: SanityExperience, baseUrl: string): Document[] {
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

function chunkSkillCategory(cat: SanitySkillCategory, baseUrl: string): Document[] {
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

function chunkTechnicalNote(note: SanityTechnicalNote, baseUrl: string): Document[] {
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

async function fetchFromSanity() {
  console.log("Fetching content from Sanity...");
  return Promise.all([
    client.fetch<SanityProject[]>(
      groq`*[_type == "project" && published == true] { _id, title, "slug": slug.current, shortSummary, problemStatement, approach, results, limitations, futureImprovements, technologies, keyMetrics }`
    ),
    client.fetch<SanitySiteSettings>(
      groq`*[_type == "siteSettings"][0] { name, shortBio, aboutSummary, focusAreas, contactHeadline, contactDescription, heroDescription }`
    ),
    client.fetch<SanityExperience[]>(
      groq`*[_type == "experience"] { _id, role, company, shortDescription, bulletPoints, skills }`
    ),
    client.fetch<SanitySkillCategory[]>(
      groq`*[_type == "skillCategory"] { _id, title, skills }`
    ),
    client.fetch<SanityTechnicalNote[]>(
      groq`*[_type == "technicalNote" && defined(publishedDate)] { _id, title, "slug": slug.current, shortSummary, tags }`
    ),
  ]);
}

function getFallbackContent() {
  console.log("Sanity is not configured. Using fallback content...");
  const projects: SanityProject[] = fallbackProjects.map(fallbackToSanityProject);
  const settings: SanitySiteSettings = fallbackToSanitySiteSettings(fallbackSiteSettings);
  const experiences: SanityExperience[] = fallbackExperiences.map(fallbackToSanityExperience);
  const skillCategories: SanitySkillCategory[] =
    fallbackSkillCategories.map(fallbackToSanitySkillCategory);
  const technicalNotes: SanityTechnicalNote[] = [];

  return [projects, settings, experiences, skillCategories, technicalNotes] as const;
}

async function main() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  if (!projectId) {
    console.warn(
      "ℹ  NEXT_PUBLIC_SANITY_PROJECT_ID is not set. Using fallback content.\n" +
      "   Copy .env.example to .env.local and fill in your Sanity project ID to use live content."
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const vectorUrl = process.env.VECTOR_URL || "http://localhost:6333";
  const collectionName = process.env.QDRANT_COLLECTION || "portfolio_chunks";

  const [projects, settings, experiences, skillCategories, technicalNotes] =
    isSanityConfigured ? await fetchFromSanity() : getFallbackContent();

  const documents: Document[] = [];

  for (const project of projects || []) {
    documents.push(...chunkProject(project, baseUrl));
  }

  if (settings) {
    documents.push(...chunkSiteSettings(settings, baseUrl));
  }

  for (const exp of experiences || []) {
    documents.push(...chunkExperience(exp, baseUrl));
  }

  for (const cat of skillCategories || []) {
    documents.push(...chunkSkillCategory(cat, baseUrl));
  }

  for (const note of technicalNotes || []) {
    documents.push(...chunkTechnicalNote(note, baseUrl));
  }

  console.log(`Generated ${documents.length} document chunks.`);

  if (documents.length === 0) {
    console.log("No documents to index. Exiting.");
    return;
  }

  console.log("Connecting to Qdrant...");

  const embeddings = await getEmbeddings();

  try {
    await QdrantVectorStore.fromDocuments(documents, embeddings, {
      url: vectorUrl,
      collectionName,
    });

    console.log(`\n✅ Indexed ${documents.length} chunks into Qdrant collection "${collectionName}".`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message.includes("ECONNREFUSED") ||
      message.includes("connect") ||
      message.includes("Could not connect")
    ) {
      console.error(
        `\n❌ Could not connect to Qdrant at ${vectorUrl}.\n` +
        `   Make sure Qdrant is running:\n` +
        `     docker compose up -d\n` +
        `   Or set VECTOR_URL in .env.local if using a different address.`
      );
    } else {
      console.error(`\n❌ Qdrant error: ${message}`);
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Indexing failed:", error);
  process.exit(1);
});
