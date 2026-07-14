import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { createProject } from "./publish-tool";

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: npx tsx scripts/create-project.ts <json-file>");
    process.exit(1);
  }

  const resolved = path.resolve(jsonPath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  const input = JSON.parse(raw);
  // Honor an explicit __markdownDir__ carried in the payload (used by the
  // spec-driven agent flow) so image paths resolve against the spec's
  // directory rather than this temp JSON's directory. Falls back to the
  // JSON file's directory for legacy callers.
  const payloadRecord = input as Record<string, unknown>;
  const markdownDir =
    typeof payloadRecord.__markdownDir__ === "string"
      ? path.resolve(payloadRecord.__markdownDir__)
      : path.dirname(resolved);
  delete payloadRecord.__markdownDir__;

  await createProject(input, markdownDir);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
