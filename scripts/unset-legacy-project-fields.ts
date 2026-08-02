import "./load-env";
import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "../sanity/env";

// T15c — final destructive cleanup step of the metadata/narrative separation
// migration. Removes the legacy flat narrative fields (now dropped from the
// project schema) from the dataset, leaving metadata and `content` untouched.
// Run only against the **local** dataset after the new model is verified:
//   npx tsx scripts/unset-legacy-project-fields.ts [--dry-run]

const LEGACY_FIELDS = [
  "whyIBuiltIt",
  "theProblem",
  "theSolution",
  "architectureImage",
  "engineeringDecisions",
  "interestingChallenges",
  "results",
  "whatThisDemonstrates",
  "exampleInputsOutputs",
  "lessonsLearned",
  "limitations",
  "futureImprovements",
  "timeline",
  "faq",
  "detailedContent",
  "problemStatement",
  "approach",
];

const writeToken = process.env.SANITY_API_WRITE_TOKEN;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!projectId) {
    console.error("NEXT_PUBLIC_SANITY_PROJECT_ID is not set. Exiting.");
    process.exit(1);
  }
  if (!dryRun && !writeToken) {
    console.error(
      "SANITY_API_WRITE_TOKEN is required (or pass --dry-run). Add it to .env.local."
    );
    process.exit(1);
  }

  const client = createClient({
projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: writeToken,
  });

  const projects: Array<{ _id: string }> = await client.fetch(
    `*[_type == "project"]{ _id }`
  );
  if (!projects?.length) {
    console.log("No projects found.");
    return;
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Removing legacy fields from ${projects.length} project(s) in dataset "${dataset}".`
  );

  for (const project of projects) {
    if (dryRun) {
      console.log(`  would clear ${project._id}`);
      continue;
    }
    await client.patch(project._id).unset(LEGACY_FIELDS).commit();
    console.log(`  cleared ${project._id}`);
  }

  const summary = dryRun
    ? "Dry run complete — no data was modified."
    : `Unset ${LEGACY_FIELDS.length} legacy fields on ${projects.length} project(s). Metadata and content untouched.`;
  console.log(summary);
}

main().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});