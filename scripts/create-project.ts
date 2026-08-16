import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "../sanity/env";

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: npx tsx scripts/create-project.ts <json-file>");
    console.error("");
    console.error("JSON shape: { title, slug, shortSummary?, displayOrder?, technologies?, sections?, published? }");
    process.exit(1);
  }

  const resolved = path.resolve(jsonPath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const writeToken = process.env.SANITY_API_WRITE_TOKEN;
  if (!writeToken) throw new Error("SANITY_API_WRITE_TOKEN is required.");
  const client = createClient({ projectId, dataset, apiVersion, useCdn: false, token: writeToken });

  const input = JSON.parse(fs.readFileSync(resolved, "utf-8")) as {
    title: string;
    slug: string;
    shortSummary?: string;
    displayOrder?: number;
    technologies?: string[];
    sections?: Array<{ _key?: string; title: string; description?: string }>;
    published?: boolean;
  };

  if (!input.title || !input.slug) {
    console.error("JSON must include 'title' and 'slug'.");
    process.exit(1);
  }

  const existing: { _id: string } | null = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug: input.slug }
  );
  if (existing) {
    throw new Error(`Project with slug "${input.slug}" already exists (${existing._id}).`);
  }

  const doc = await client.create({
    _type: "project",
    title: input.title.trim(),
    slug: { _type: "slug", current: input.slug },
    shortSummary: input.shortSummary ?? "",
    displayOrder: input.displayOrder ?? 99,
    technologies: input.technologies ?? [],
    sections: (input.sections ?? []).map((s, i) => ({
      _key: s._key ?? `sec-${i}`,
      _type: "object",
      title: s.title,
      description: s.description ?? "",
    })),
    published: input.published ?? false,
  });

  console.log(`✅ Created project "${input.title}" (${doc._id})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
