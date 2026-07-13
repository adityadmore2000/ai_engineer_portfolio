import "./load-env";
import { deleteProject } from "./publish-tool";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npx tsx scripts/delete-project.ts <slug>");
    process.exit(1);
  }

  const result = await deleteProject(slug);
  console.log(`✅ Deleted ${result.deleted.length} document(s):`);
  for (const id of result.deleted) {
    console.log(`   • ${id}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
