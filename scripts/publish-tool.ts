import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "../sanity/env";
import { client as readClient } from "../sanity/client";
import fs from "node:fs";
import path from "node:path";

const writeToken = process.env.SANITY_API_WRITE_TOKEN;

type ImageRef = {
  _type: "image";
  asset: { _type: "reference"; _ref: string };
  alt?: string;
};

export interface ProjectPublishInput {
  title: string;
  slug: string;
  shortSummary?: string;
  coverImage?: string;
  coverImageAlt?: string;
  technologies?: string[];
  keyMetrics?: string[];
  githubUrl?: string;
  demoUrl?: string;
  featured?: boolean;
  displayOrder?: number;
  problemStatement?: string;
  approach?: string;
  results?: string;
  architectureImage?: string;
  architectureImageAlt?: string;
  screenshots?: string[];
  screenshotAlts?: string[];
  limitations?: string;
  futureImprovements?: string;
}

function getWriteClient() {
  if (!writeToken) {
    throw new Error(
      "SANITY_API_WRITE_TOKEN is required. Add it to your .env.local file."
    );
  }
  if (!projectId) {
    throw new Error(
      "NEXT_PUBLIC_SANITY_PROJECT_ID is required. Add it to your .env.local file."
    );
  }
  return createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token: writeToken,
  });
}

async function uploadImage(
  client: ReturnType<typeof getWriteClient>,
  imagePath: string,
  markdownDir: string
) {
  const resolved = path.resolve(markdownDir, imagePath);

  if (!fs.existsSync(resolved)) {
    console.warn(`  ⚠  Image not found: ${resolved}`);
    return undefined;
  }

  const filename = path.basename(resolved);
  const mimeType =
    filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
        ? "image/webp"
        : filename.endsWith(".jpg") || filename.endsWith(".jpeg")
          ? "image/jpeg"
          : filename.endsWith(".gif")
            ? "image/gif"
            : filename.endsWith(".svg")
              ? "image/svg+xml"
              : "image/png";

  const stream = fs.createReadStream(resolved);
  const asset = await client.assets.upload("image", stream, {
    filename,
    contentType: mimeType,
  });

  return {
    _type: "image" as const,
    asset: {
      _type: "reference" as const,
      _ref: asset._id,
    },
  } as ImageRef;
}

export type ProjectReadOutput = {
  _id: string;
  title: string;
  slug: string;
  shortSummary?: string;
  technologies?: string[];
  keyMetrics?: string[];
  githubUrl?: string;
  demoUrl?: string;
  featured?: boolean;
  displayOrder?: number;
  problemStatement?: string;
  approach?: string;
  results?: string;
  limitations?: string;
  futureImprovements?: string;
  coverImageAlt?: string;
  architectureImageAlt?: string;
  screenshotAlts?: string[];
};

const readProjectQuery = `*[_type == "project" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  shortSummary,
  technologies,
  keyMetrics,
  githubUrl,
  demoUrl,
  featured,
  displayOrder,
  problemStatement,
  approach,
  results,
  limitations,
  futureImprovements,
  coverImage{alt},
  architectureImage{alt},
  screenshots[]{alt}
}`;

export async function readProject(
  slug: string
): Promise<ProjectReadOutput | null> {
  const doc = await readClient.fetch<Record<string, unknown> | null>(
    readProjectQuery,
    { slug }
  );
  if (!doc) return null;
  return {
    _id: doc._id as string,
    title: doc.title as string,
    slug: doc.slug as string,
    shortSummary: (doc.shortSummary as string) ?? undefined,
    technologies: (doc.technologies as string[]) ?? undefined,
    keyMetrics: (doc.keyMetrics as string[]) ?? undefined,
    githubUrl: (doc.githubUrl as string) ?? undefined,
    demoUrl: (doc.demoUrl as string) ?? undefined,
    featured: doc.featured as boolean | undefined,
    displayOrder: doc.displayOrder as number | undefined,
    problemStatement: (doc.problemStatement as string) ?? undefined,
    approach: (doc.approach as string) ?? undefined,
    results: (doc.results as string) ?? undefined,
    limitations: (doc.limitations as string) ?? undefined,
    futureImprovements: (doc.futureImprovements as string) ?? undefined,
    coverImageAlt: ((doc.coverImage as Record<string, string> | null)?.alt) ?? undefined,
    architectureImageAlt: ((doc.architectureImage as Record<string, string> | null)?.alt) ?? undefined,
    screenshotAlts: (doc.screenshots as Array<Record<string, string>> | undefined)
      ?.map((s) => s.alt) ?? undefined,
  };
}

export async function listProjects(
  search?: string
): Promise<Array<{ title: string; slug: string }>> {
  if (search) {
    const docs = await readClient.fetch<
      Array<{ title: string; slug: string }>
    >(
      `*[_type == "project" && title match $search] | order(title asc) { title, "slug": slug.current }`,
      { search: `*${search}*` }
    );
    return docs ?? [];
  }
  const docs = await readClient.fetch<
    Array<{ title: string; slug: string }>
  >(
    `*[_type == "project"] | order(title asc) { title, "slug": slug.current }`
  );
  return docs ?? [];
}

export async function deleteProject(slug: string): Promise<{ deleted: string[] }> {
  const client = getWriteClient();

  const project: { _id: string } | null = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug }
  );
  if (!project) {
    throw new Error(`Project with slug "${slug}" not found.`);
  }

  const docPages: Array<{ _id: string }> = await client.fetch(
    `*[_type == "projectDocumentationPage" && project._ref == $projectId]{_id}`,
    { projectId: project._id }
  );

  const idsToDelete = [project._id, ...docPages.map((p) => p._id)];
  const tx = client.transaction();
  for (const id of idsToDelete) {
    tx.delete(id);
  }
  await tx.commit();

  return { deleted: idsToDelete };
}

export async function publishProject(
  input: ProjectPublishInput,
  markdownDir: string
) {
  console.log(`\n  Project: ${input.title}`);
  console.log(`  Slug:    ${input.slug}`);

  const client = getWriteClient();

  /* ── Upload images ────────────────────────────────── */

  console.log("  Images:");

  let coverImageRef = undefined;
  if (input.coverImage) {
    console.log(`    cover  → ${input.coverImage}`);
    coverImageRef = await uploadImage(client, input.coverImage, markdownDir);
    if (coverImageRef && input.coverImageAlt) {
      coverImageRef.alt = input.coverImageAlt;
    }
  }

  let architectureImageRef = undefined;
  if (input.architectureImage) {
    console.log(`    arch   → ${input.architectureImage}`);
    architectureImageRef = await uploadImage(
      client,
      input.architectureImage,
      markdownDir
    );
    if (architectureImageRef && input.architectureImageAlt) {
      architectureImageRef.alt = input.architectureImageAlt;
    }
  }

  const screenshotRefs: ImageRef[] = [];
  if (input.screenshots?.length) {
    for (let i = 0; i < input.screenshots.length; i++) {
      console.log(`    ss[${i}] → ${input.screenshots[i]}`);
      const ref = await uploadImage(
        client,
        input.screenshots[i],
        markdownDir
      );
      if (ref) {
        ref.alt = input.screenshotAlts?.[i] ?? "";
        screenshotRefs.push(ref);
      }
    }
  }

  /* ── Build document ────────────────────────────────── */

  const doc: { [key: string]: unknown; _type: string } = {
    _type: "project",
    title: input.title,
    slug: { _type: "slug", current: input.slug },
    shortSummary: input.shortSummary ?? "",
    technologies: input.technologies ?? [],
    keyMetrics: input.keyMetrics ?? [],
    githubUrl: input.githubUrl ?? "",
    demoUrl: input.demoUrl ?? "",
    featured: input.featured ?? true,
    displayOrder: input.displayOrder ?? 0,
    problemStatement: input.problemStatement ?? "",
    approach: input.approach ?? "",
    results: input.results ?? "",
    limitations: input.limitations ?? "",
    futureImprovements: input.futureImprovements ?? "",
  };

  if (coverImageRef) doc.coverImage = coverImageRef;
  if (architectureImageRef) doc.architectureImage = architectureImageRef;
  if (screenshotRefs.length) doc.screenshots = screenshotRefs;

  /* ── Check existence & create/patch ────────────────── */

  console.log("  Looking up existing project…");

  const existing: { _id: string } | null = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug: input.slug }
  );

  if (existing) {
    console.log(`  Found — ${existing._id}`);
    const { _type, slug, ...patchData } = doc;
    void _type;
    void slug;
    await client.patch(existing._id).set(patchData).commit();
    console.log(`  ✅ Updated project "${input.title}"`);
  } else {
    console.log("  New project — creating…");
    const result = await client.create(doc);
    console.log(`  ✅ Created project "${input.title}" (${result._id})`);
  }
}
