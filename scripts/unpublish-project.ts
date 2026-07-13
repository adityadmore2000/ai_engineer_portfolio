import "./load-env";
import { unpublishProjectBySlug } from "./publish-tool";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npx tsx scripts/unpublish-project.ts <slug>");
    process.exit(1);
  }

  await unpublishProjectBySlug(slug);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
