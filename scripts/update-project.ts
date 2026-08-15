import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "../sanity/env";

async function main() {
  const jsonPath = process.argv[2];
  const slug = process.argv[3];
  if (!jsonPath || !slug) {
    console.error("Usage: npx tsx scripts/update-project.ts <json-file> <slug>");
    console.error("");
    console.error("JSON shape: { title?, shortSummary?, displayOrder?, technologies?, sections?, published? }");
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
    title?: string;
    shortSummary?: string;
    displayOrder?: number;
    technologies?: string[];
    sections?: Array<{ _key?: string; title: string; description?: string }>;
    published?: boolean;
  };

  const existing: { _id: string } | null = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug }
  );
  if (!existing) {
    throw new Error(`Project with slug "${slug}" not found.`);
  }

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.shortSummary !== undefined) patch.shortSummary = input.shortSummary;
  if (input.displayOrder !== undefined) patch.displayOrder = input.displayOrder;
  if (input.technologies !== undefined) patch.technologies = input.technologies;
  if (input.published !== undefined) patch.published = input.published;
  if (input.sections !== undefined) {
    patch.sections = input.sections.map((s, i) => ({
      _key: s._key ?? `sec-${i}`,
      _type: "object",
      title: s.title,
      description: s.description ?? "",
    }));
  }

  if (Object.keys(patch).length === 0) {
    console.log("No fields to update.");
    return;
  }

  await client.patch(existing._id).set(patch).commit();
  console.log(`✅ Updated project "${slug}"`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
