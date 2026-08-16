import "./load-env";
import { publishProjectBySlug } from "./publish-tool";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npx tsx scripts/publish.ts <slug>");
    process.exit(1);
  }

  await publishProjectBySlug(slug);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
