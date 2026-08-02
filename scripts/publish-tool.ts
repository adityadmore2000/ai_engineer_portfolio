import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "../sanity/env";
import { client as readClient } from "../sanity/client";
import { uploadImage, type ImageRef } from "./lib/upload";

const writeToken = process.env.SANITY_API_WRITE_TOKEN;

export interface ProjectPublishInput {
  title: string;
  slug: string;
  shortSummary?: string;
  status?: string;
  coverImage?: string;
  coverImageAlt?: string;
  technologies?: string[];
  keyMetrics?: string[];
  githubUrl?: string;
  demoUrl?: string;
  featured?: boolean;
  displayOrder?: number;
  screenshots?: string[];
  screenshotAlts?: string[];
  demoVideo?: string;
  published?: boolean;
}

// ── Field classification (schema-agnostic) ────────────────
// Image and alt fields are special-cased (uploads / dotted-path patches).
// The meta fields are set explicitly. Every other field in the payload is
// copied through generically, so newly added Sanity fields map automatically
// (the agent discovers them from the Studio schema; this layer sets them).

const IMAGE_KEYS = new Set(["coverImage", "screenshots"]);
const ALT_KEYS = new Set(["coverImageAlt", "screenshotAlts"]);
const META_KEYS = new Set([
  "_type",
  "title",
  "slug",
  "published",
  "__markdownDir__",
]);
const BLOCK_KEYS = new Set(["content", "faqItem", "challengeCard"]);

function setGenericFields(
  target: Record<string, unknown>,
  source: object
) {
  for (const [key, value] of Object.entries(source)) {
    if (META_KEYS.has(key) || IMAGE_KEYS.has(key) || ALT_KEYS.has(key) || BLOCK_KEYS.has(key)) continue;
    if (value === undefined || value === null) continue;
    target[key] = value;
  }
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

export type ProjectReadOutput = {
  _id: string;
  title: string;
  slug: string;
  shortSummary?: string;
  status?: string;
  technologies?: string[];
  keyMetrics?: string[];
  githubUrl?: string;
  demoUrl?: string;
  featured?: boolean;
  displayOrder?: number;
  demoVideo?: string;
  coverImageAlt?: string;
  screenshotAlts?: string[];
  published?: boolean;
  content?: unknown[];
};

const readProjectQuery = `*[_type == "project" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  shortSummary,
  status,
  technologies,
  keyMetrics,
  githubUrl,
  demoUrl,
  featured,
  displayOrder,
  demoVideo,
  coverImage{alt},
  screenshots[]{alt},
  published,
  content
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
    status: (doc.status as string) ?? undefined,
    technologies: (doc.technologies as string[]) ?? undefined,
    keyMetrics: (doc.keyMetrics as string[]) ?? undefined,
    githubUrl: (doc.githubUrl as string) ?? undefined,
    demoUrl: (doc.demoUrl as string) ?? undefined,
    featured: doc.featured as boolean | undefined,
    displayOrder: doc.displayOrder as number | undefined,
    demoVideo: (doc.demoVideo as string) ?? undefined,
    coverImageAlt: ((doc.coverImage as Record<string, string> | null)?.alt) ?? undefined,
    screenshotAlts: (doc.screenshots as Array<Record<string, string>> | undefined)
      ?.map((s) => s.alt) ?? undefined,
    published: doc.published as boolean | undefined,
    content: (doc.content as unknown[] | undefined) ?? undefined,
  };
}

export async function listProjects(
  search?: string
): Promise<Array<{ title: string; slug: string; published?: boolean }>> {
  if (search) {
    const docs = await readClient.fetch<
      Array<{ title: string; slug: string; published?: boolean }>
    >(
      `*[_type == "project" && title match $search] | order(title asc) { title, "slug": slug.current, published }`,
      { search: `*${search}*` }
    );
    return docs ?? [];
  }
  const docs = await readClient.fetch<
    Array<{ title: string; slug: string; published?: boolean }>
  >(
    `*[_type == "project"] | order(title asc) { title, "slug": slug.current, published }`
  );
  return docs ?? [];
}

/* ── Image upload helpers ──────────────────────────────── */

async function uploadCoverImage(
  client: ReturnType<typeof getWriteClient>,
  input: { coverImage?: string; coverImageAlt?: string },
  markdownDir: string
) {
  if (!input.coverImage) return undefined;
  const ref = await uploadImage(client, input.coverImage, markdownDir);
  if (ref && input.coverImageAlt) {
    ref.alt = input.coverImageAlt;
  }
  return ref;
}

async function uploadScreenshots(
  client: ReturnType<typeof getWriteClient>,
  input: { screenshots?: string[]; screenshotAlts?: string[] },
  markdownDir: string
) {
  const refs: ImageRef[] = [];
  if (input.screenshots?.length) {
    for (let i = 0; i < input.screenshots.length; i++) {
      const ref = await uploadImage(client, input.screenshots[i], markdownDir);
      if (ref) {
        ref.alt = input.screenshotAlts?.[i] ?? "";
        refs.push(ref);
      }
    }
  }
  return refs;
}

/* ── Create (fails if slug exists) ─────────────────────── */

export async function createProject(
  input: ProjectPublishInput,
  markdownDir: string
) {
  console.log(`\n  Project: ${input.title}`);
  console.log(`  Slug:    ${input.slug}`);

  const client = getWriteClient();

  const existing: { _id: string } | null = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug: input.slug }
  );
  if (existing) {
    throw new Error(
      `Project with slug "${input.slug}" already exists (${existing._id}). Use update_project to modify it.`
    );
  }

  console.log("  Images:");

  const coverImageRef = await uploadCoverImage(client, input, markdownDir);
  const screenshotRefs = await uploadScreenshots(client, input, markdownDir);

  const doc: Record<string, unknown> & { _type: string } = {
    _type: "project",
    title: input.title,
    slug: { _type: "slug", current: input.slug },
    published: input.published ?? true,
  };

  setGenericFields(doc, input);

  if (coverImageRef) doc.coverImage = coverImageRef;
  if (screenshotRefs.length) doc.screenshots = screenshotRefs;

  const result = await client.create(doc);
  console.log(`  ✅ Created project "${input.title}" (${result._id})`);
}

/* ── Update (fails if slug missing; partial patch) ────── */

export async function updateProject(
  slug: string,
  input: Partial<Omit<ProjectPublishInput, "slug">>,
  markdownDir: string
) {
  console.log(`\n  Slug:    ${slug}`);

  const client = getWriteClient();

  const existing: { _id: string } | null = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug }
  );
  if (!existing) {
    throw new Error(`Project with slug "${slug}" not found. Cannot update.`);
  }

  if (input.title) {
    console.log(`  Title:   ${input.title}`);
  }

  console.log("  Images:");

  const coverImageRef = await uploadCoverImage(client, input, markdownDir);
  const screenshotRefs = await uploadScreenshots(client, input, markdownDir);

  const patchData: Record<string, unknown> = {};
  if (input.title !== undefined) patchData.title = input.title;
  if (input.published !== undefined) patchData.published = input.published;
  setGenericFields(patchData, input);
  if (coverImageRef) patchData.coverImage = coverImageRef;
  if (input.coverImageAlt !== undefined && !input.coverImage) {
    patchData["coverImage.alt"] = input.coverImageAlt;
  }
  if (screenshotRefs.length) patchData.screenshots = screenshotRefs;

  if (Object.keys(patchData).length === 0) {
    console.log("  No fields to update.");
    return;
  }

  await client.patch(existing._id).set(patchData).commit();
  console.log(`  ✅ Updated project "${slug}"`);
}

/* ── Publish (set published=true) ──────────────────────── */

export async function publishProjectBySlug(slug: string) {
  console.log(`\n  Publish: ${slug}`);

  const client = getWriteClient();

  const existing: { _id: string } | null = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug }
  );
  if (!existing) {
    throw new Error(`Project with slug "${slug}" not found.`);
  }

  await client.patch(existing._id).set({ published: true }).commit();
  console.log(`  ✅ Published project "${slug}"`);
}

/* ── Unpublish (set published=false) ───────────────────── */

export async function unpublishProjectBySlug(slug: string) {
  console.log(`\n  Unpublish: ${slug}`);

  const client = getWriteClient();

  const existing: { _id: string } | null = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug }
  );
  if (!existing) {
    throw new Error(`Project with slug "${slug}" not found.`);
  }

  await client.patch(existing._id).set({ published: false }).commit();
  console.log(`  ✅ Unpublished project "${slug}"`);
}

/* ── Delete ────────────────────────────────────────────── */

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

/* ── Original publish (upsert — kept for backward compat) ── */

export async function publishProject(
  input: ProjectPublishInput,
  markdownDir: string
) {
  const client = getWriteClient();

  const existing: { _id: string } | null = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug: input.slug }
  );

  if (existing) {
    await updateProject(input.slug, input, markdownDir);
  } else {
    await createProject(input, markdownDir);
  }
}
