import "./load-env";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";

const PROD_DATASET = "production";
const LOCAL_DATASET = process.env.SANITY_LOCAL_DATASET || "local";

type Direction = "prod-to-local" | "local-to-prod";

function usage(): never {
  console.error(
    "Usage: npx tsx scripts/sync-dataset.ts <prod-to-local|local-to-prod>"
  );
  process.exit(1);
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code: number) => {
      if (code !== 0) {
        reject(
          new Error(`Command exited with code ${code}: ${cmd} ${args.join(" ")}`)
        );
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  const direction = process.argv[2] as Direction | undefined;
  if (direction !== "prod-to-local" && direction !== "local-to-prod") {
    usage();
  }

  if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
    console.error("NEXT_PUBLIC_SANITY_PROJECT_ID is required in .env.local");
    process.exit(1);
  }

  // Propagate the write token so the Sanity CLI can authenticate non-interactively.
  if (
    !process.env.SANITY_AUTH_TOKEN &&
    process.env.SANITY_API_WRITE_TOKEN
  ) {
    process.env.SANITY_AUTH_TOKEN = process.env.SANITY_API_WRITE_TOKEN;
  }

  let sourceDataset: string;
  let destDataset: string;
  if (direction === "prod-to-local") {
    sourceDataset = PROD_DATASET;
    destDataset = LOCAL_DATASET;
  } else {
    sourceDataset = LOCAL_DATASET;
    destDataset = PROD_DATASET;
  }

  const tarball = path.join(
    os.tmpdir(),
    `${sourceDataset}-sync-${Date.now()}.tar.gz`
  );

  console.log(
    `🔄 Syncing ${sourceDataset} → ${destDataset} (${direction})…`
  );

  try {
    console.log(`\n⬇️  Exporting "${sourceDataset}" → ${tarball}`);
    await run("npx", [
      "sanity",
      "dataset",
      "export",
      sourceDataset,
      tarball,
    ]);

    console.log(`\n⬆️  Importing → "${destDataset}" (--replace)`);
    await run("npx", [
      "sanity",
      "dataset",
      "import",
      tarball,
      destDataset,
      "--replace",
    ]);

    console.log(`\n✅ Synced ${sourceDataset} → ${destDataset}`);
  } finally {
    if (fs.existsSync(tarball)) {
      fs.unlinkSync(tarball);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});