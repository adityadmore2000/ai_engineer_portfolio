import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { updateProject } from "./publish-tool";

async function main() {
  const jsonPath = process.argv[2];
  const slug = process.argv[3];
  if (!jsonPath || !slug) {
    console.error("Usage: npx tsx scripts/update-project.ts <json-file> <slug>");
    process.exit(1);
  }

  const resolved = path.resolve(jsonPath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  const input = JSON.parse(raw);
  const payloadRecord = input as Record<string, unknown>;
  const markdownDir =
    typeof payloadRecord.__markdownDir__ === "string"
      ? path.resolve(payloadRecord.__markdownDir__)
      : path.dirname(resolved);
  delete payloadRecord.__markdownDir__;

  await updateProject(slug, input, markdownDir);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
