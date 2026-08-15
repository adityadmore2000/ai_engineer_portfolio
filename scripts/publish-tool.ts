import { createClient } from "@sanity/client";
import { apiVersion, dataset, projectId } from "../sanity/env";
import { client as readClient } from "../sanity/client";

const writeToken = process.env.SANITY_API_WRITE_TOKEN;

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
  technologies?: string[];
  displayOrder?: number;
  published?: boolean;
  sections?: Array<{ _key: string; title: string; description?: string }>;
};

const readProjectQuery = `*[_type == "project" && slug.current == $slug][0]{
  _id,
  title,
  "slug": slug.current,
  shortSummary,
  technologies,
  displayOrder,
  published,
  sections[]{ _key, title, description }
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
    displayOrder: doc.displayOrder as number | undefined,
    published: doc.published as boolean | undefined,
    sections: (doc.sections as Array<{ _key: string; title: string; description?: string }>) ?? undefined,
  };
}

export async function listProjects(
  search?: string
): Promise<Array<{ title: string; slug: string; published?: boolean }>> {
  if (search) {
    const docs = await readClient.fetch<
      Array<{ title: string; slug: string; published?: boolean }>
    >(
      `*[_type == "project" && title match $search] | order(displayOrder asc, title asc) { title, "slug": slug.current, published }`,
      { search: `*${search}*` }
    );
    return docs ?? [];
  }
  const docs = await readClient.fetch<
    Array<{ title: string; slug: string; published?: boolean }>
  >(
    `*[_type == "project"] | order(displayOrder asc, title asc) { title, "slug": slug.current, published }`
  );
  return docs ?? [];
}

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

export async function deleteProject(slug: string): Promise<{ deleted: string[] }> {
  const client = getWriteClient();

  const project: { _id: string } | null = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug }
  );
  if (!project) {
    throw new Error(`Project with slug "${slug}" not found.`);
  }

  await client.delete(project._id);
  console.log(`  ✅ Deleted project "${slug}"`);
  return { deleted: [project._id] };
}
