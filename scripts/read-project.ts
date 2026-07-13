import "./load-env";
import { readProject } from "./publish-tool";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npx tsx scripts/read-project.ts <slug>");
    process.exit(1);
  }

  const project = await readProject(slug);
  if (!project) {
    console.error(`Project not found: ${slug}`);
    process.exit(1);
  }

  console.log(JSON.stringify(project, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
