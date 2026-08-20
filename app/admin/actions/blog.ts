"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/lib/sanity/write-client";
import { client as readClient } from "@/sanity/client";
import { adminBlogPostsQuery } from "@/lib/sanity/admin-queries";
import { requireAdmin } from "@/lib/admin/auth";
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_FILE_SIZE } from "@/lib/utils/media-ref";

export type AdminBlogPost = {
  _id: string;
  _rev?: string;
  title: string;
  slug?: string;
  summary?: string;
  coverImage?: {
    url: string;
    alt?: string;
    assetRef?: string;
  };
  publishedAt?: string;
  displayOrder?: number;
  published: boolean;
};

export type BlogCoverImageInput = { _ref?: string; alt?: string };

export type CreateBlogPostData = {
  title: string;
  slug?: string;
  summary?: string;
  coverImage?: BlogCoverImageInput;
  publishedAt?: string;
  displayOrder?: number;
  published: boolean;
};
export type UpdateBlogPostData = Partial<CreateBlogPostData> & { _rev?: string };

async function getBlogPostById(id: string): Promise<AdminBlogPost | null> {
  return readClient.fetch<AdminBlogPost | null>(
    `*[_type == "blogPost" && _id == $id][0]{
      _id, _rev, title, "slug": slug.current, summary,
      coverImage{ "url": asset->url, "alt": coalesce(alt, asset->altText, ""), "assetRef": asset->_id },
      publishedAt, displayOrder, published
    }`,
    { id }
  );
}

export async function getAdminBlogPosts(): Promise<AdminBlogPost[]> {
  const result = await readClient.fetch<AdminBlogPost[] | null>(adminBlogPostsQuery);
  return result ?? [];
}

export async function createBlogPost(data: CreateBlogPostData): Promise<AdminBlogPost> {
  await requireAdmin();
  const writeClient = getWriteClient();

  const doc: { _type: string; [key: string]: unknown } = {
    _type: "blogPost",
    title: data.title,
    slug: { _type: "slug", current: data.slug ?? "" },
    summary: data.summary ?? "",
    publishedAt: data.publishedAt ?? null,
    displayOrder: data.displayOrder ?? 99,
    published: data.published ?? false,
  };

  if (data.coverImage?._ref) {
    doc.coverImage = {
      _type: "image",
      asset: { _type: "reference", _ref: data.coverImage._ref },
      alt: data.coverImage.alt ?? "",
    };
  }

  const created_doc = await writeClient.create(doc);
  const created = await getBlogPostById(created_doc._id);
  if (!created) throw new Error("Failed to fetch blog post after create");
  revalidatePath("/");
  return created;
}

export async function updateBlogPost(id: string, data: UpdateBlogPostData): Promise<AdminBlogPost> {
  await requireAdmin();
  const writeClient = getWriteClient();

  const patch: Record<string, unknown> = {
    title: data.title,
    "slug.current": data.slug ?? "",
    summary: data.summary ?? "",
    publishedAt: data.publishedAt ?? null,
    displayOrder: data.displayOrder,
    published: data.published ?? false,
  };

  if (data.coverImage?._ref) {
    patch.coverImage = {
      _type: "image",
      asset: { _type: "reference", _ref: data.coverImage._ref },
      alt: data.coverImage.alt ?? "",
    };
  } else if (data.coverImage?.alt !== undefined && !data.coverImage._ref) {
    patch["coverImage.alt"] = data.coverImage.alt;
  }

  const patchBuilder = writeClient.patch(id);
  if (data._rev) {
    await patchBuilder.ifRevisionId(data._rev).set(patch).commit();
  } else {
    await patchBuilder.set(patch).commit();
  }

  const updated = await getBlogPostById(id);
  if (!updated) throw new Error("Failed to fetch blog post after update");
  revalidatePath("/");
  return updated;
}

export async function deleteBlogPost(id: string): Promise<void> {
  await requireAdmin();
  const writeClient = getWriteClient();
  await writeClient.delete(id);
  revalidatePath("/");
}

export async function reorderBlogPosts(items: Array<{ _id: string; displayOrder: number }>): Promise<void> {
  await requireAdmin();
  const writeClient = getWriteClient();
  const tx = writeClient.transaction();
  for (const { _id, displayOrder } of items) {
    tx.patch(_id, (p) => p.set({ displayOrder }));
  }
  await tx.commit();
  revalidatePath("/");
}

export async function uploadBlogCoverImage(formData: FormData): Promise<{ assetId: string; url: string }> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");
  if (!(ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new Error("File type not supported. Allowed types: PNG, JPEG, WebP, GIF.");
  }
  if (file.size > MAX_UPLOAD_FILE_SIZE) {
    throw new Error("File too large. Maximum size is 5MB.");
  }
  const writeClient = getWriteClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const asset = await writeClient.assets.upload("image", buffer, {
    filename: file.name,
    contentType: file.type,
  });
  if (!asset._id || !asset.url) throw new Error("Upload succeeded but Sanity did not return asset details.");
  return { assetId: asset._id, url: asset.url };
}
