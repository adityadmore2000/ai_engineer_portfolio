import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "../sanity/env";

/**
 * Legacy narrative → committed Markdown docs migration (local dataset only).
 *
 * Reads the legacy flat narrative fields of every project via a raw GROQ
 * projection (the fields still exist in the local dataset — they are removed
 * only in Phase 8) and emits `projects/<slug>/docs/*.md` in the canonical
 * narrative order, preserving the legacy anchor headings so existing chat
 * citations keep resolving.
 *
 * The Markdown documents are the source of truth: they are committed to git
 * and re-published into `project.content` by the shared publish-docs pipeline.
 *
 * Usage:
 *   npx tsx scripts/migrate-legacy-content.ts             # write + publish
 *   npx tsx scripts/migrate-legacy-content.ts --dry-run   # write only, no publish
 */

const WRITE_TOKEN = process.env.SANITY_API_WRITE_TOKEN;

type LegacyProject = {
  _id: string;
  slug?: string;
  title?: string;
  whyIBuiltIt?: string | null;
  theProblem?: string | null;
  theSolution?: string | null;
  architectureImage?: { url?: string | null; alt?: string | null } | null;
  engineeringDecisions?: string | null;
  interestingChallenges?: Array<{
    problem?: string | null;
    solution?: string | null;
    outcome?: string | null;
  }> | null;
  results?: string | null;
  whatThisDemonstrates?: string | null;
  demoVideo?: string | null;
  exampleInputsOutputs?: string | null;
  lessonsLearned?: string | null;
  limitations?: string | null;
  futureImprovements?: string | null;
  timeline?: string | null;
  faq?: Array<{ question?: string | null; answer?: string | null }> | null;
};

type Section = { heading: string; content?: string | null; imageUrl?: string | null; imageAlt?: string | null };
type DocFile = { file: string; order: number; sections: Section[] };

function toMd(value?: string | null): string {
  return value?.trim() ? value.trim() : "";
}

function sectionMd(section: Section): string {
  if (section.imageUrl) {
    const alt = toMd(section.imageAlt) || "System architecture diagram";
    return `## ${section.heading}\n\n![${alt}](${section.imageUrl})`;
  }
  const content = toMd(section.content);
  return content ? `## ${section.heading}\n\n${content}` : "";
}

function challengeToMd(c: { problem?: string | null; solution?: string | null; outcome?: string | null }): string {
  const problem = toMd(c.problem);
  const solution = toMd(c.solution);
  const outcome = toMd(c.outcome);
  const lines: string[] = [];
  if (problem) lines.push(`**Problem:** ${problem}`);
  if (solution) lines.push(`**Solution:** ${solution}`);
  if (outcome) lines.push(`**Outcome:** ${outcome}`);
  return lines.join("\n");
}

function faqToMd(f: { question?: string | null; answer?: string | null }): string {
  const q = toMd(f.question);
  const a = toMd(f.answer);
  const lines: string[] = [];
  if (q) lines.push(`**Q:** ${q}`);
  if (a) lines.push(`**A:** ${a}`);
  return lines.join("\n");
}

function buildDocs(p: LegacyProject): DocFile[] {
  const docs: DocFile[] = [];
  const put = (file: string, order: number, sections: Section[]) => {
    docs.push({ file, order, sections });
  };

  put("overview.md", 1, [
    { heading: "Why I Built It", content: p.whyIBuiltIt },
    { heading: "The Problem", content: p.theProblem },
    { heading: "The Solution", content: p.theSolution },
  ]);

  if (p.architectureImage?.url) {
    put("architecture.md", 2, [
      {
        heading: "System Architecture",
        imageUrl: p.architectureImage.url,
        imageAlt: p.architectureImage.alt,
      },
    ]);
  }

  put("engineering-decisions.md", 3, [
    { heading: "Engineering Decisions", content: p.engineeringDecisions },
  ]);

  if (p.interestingChallenges?.length) {
    put("challenges.md", 4, [
      {
        heading: "Interesting Challenges",
        content: p.interestingChallenges.map(challengeToMd).join("\n\n"),
      },
    ]);
  }

  put("results.md", 5, [{ heading: "Results", content: p.results }]);
  put("demonstrates.md", 6, [
    { heading: "What This Demonstrates", content: p.whatThisDemonstrates },
  ]);

  put("examples.md", 7, [
    { heading: "Example Inputs / Outputs", content: p.exampleInputsOutputs },
    { heading: "Demo Video", content: p.demoVideo },
  ]);

  put("lessons-and-limitations.md", 8, [
    { heading: "Lessons Learned", content: p.lessonsLearned },
    { heading: "Limitations", content: p.limitations },
  ]);

  put("future-improvements.md", 9, [
    { heading: "Future Improvements", content: p.futureImprovements },
  ]);

  put("timeline.md", 10, [{ heading: "Timeline", content: p.timeline }]);

  if (p.faq?.length) {
    put("faq.md", 11, [
      { heading: "FAQ", content: p.faq.map(faqToMd).join("\n\n") },
    ]);
  }

  return docs;
}

function docToFile(doc: DocFile): string {
  const body = doc.sections
    .map(sectionMd)
    .filter((s) => s.trim())
    .join("\n\n");
  if (!body.trim()) return ""; // a docs file with no content is not emitted
  return `---\norder: ${doc.order}\n---\n\n${body}\n`;
}

async function main() {
  if (!projectId) {
    throw new Error("NEXT_PUBLIC_SANITY_PROJECT_ID is required in .env.local.");
  }
  if (!WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is required in .env.local.");
  }

  const client = createClient({ projectId, dataset, apiVersion, useCdn: false, token: WRITE_TOKEN });

  const projects = (await client.fetch<LegacyProject[]>(
    `*[_type == "project"] | order(coalesce(displayOrder, 999) asc, title asc) {
      _id,
      "slug": slug.current,
      title,
      whyIBuiltIt,
      theProblem,
      theSolution,
      architectureImage{ "url": asset->url, alt },
      engineeringDecisions,
      interestingChallenges[] { problem, solution, outcome },
      results,
      whatThisDemonstrates,
      demoVideo,
      exampleInputsOutputs,
      lessonsLearned,
      limitations,
      futureImprovements,
      timeline,
      faq[] { question, answer }
    }`
  )) || [];

  if (!projects.length) {
    console.log("No projects found in the local dataset.");
    return;
  }

  const projectsRoot = path.resolve(process.cwd(), "projects");

  for (const p of projects) {
    if (!p.slug) {
      console.warn(`  ⚠  Skipping project "${p.title}" (no slug).`);
      continue;
    }
    const dir = path.join(projectsRoot, p.slug, "docs");
    fs.mkdirSync(dir, { recursive: true });

    const docs = buildDocs(p);
    const emittedFiles: string[] = [];

    for (const doc of docs) {
      const rendered = docToFile(doc);
      if (!rendered) continue;
      const file = path.join(dir, doc.file);
      fs.writeFileSync(file, rendered);
      emittedFiles.push(doc.file);
    }

    // Remove stale docs files (field cleared since a previous migration run).
    for (const existing of fs.readdirSync(dir)) {
      if (!existing.endsWith(".md") || existing === "readme.md") continue;
      if (!emittedFiles.includes(existing)) {
        fs.unlinkSync(path.join(dir, existing));
      }
    }

    const summary = emittedFiles.join(", ") || "(no narrative)";
    console.log(`  • ${p.slug}: ${summary}`);
  }

  console.log(`\nEmitted Markdown docs under projects/<slug>/docs/ (${projects.length} projects).`);
  console.log("Commit these docs, then publish content with:");
  console.log("  npx tsx scripts/publish-docs.ts <slug> projects/<slug>/docs");
}

void main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});