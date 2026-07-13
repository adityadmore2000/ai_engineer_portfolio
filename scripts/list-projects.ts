import "./load-env";
import { listProjects } from "./publish-tool";

async function main() {
  const search = process.argv[2] || undefined;

  const projects = await listProjects(search);
  if (projects.length === 0) {
    console.log("No projects found.");
    return;
  }

  console.log(JSON.stringify(projects, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
