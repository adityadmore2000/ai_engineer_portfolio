"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/lib/sanity/write-client";
import { client as readClient } from "@/sanity/client";
import {
  adminProjectsQuery,
  adminProjectByIdQuery,
} from "@/lib/sanity/admin-queries";
import { requireAdmin } from "@/lib/admin/auth";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE,
  ASSET_REF_PATTERN,
} from "@/lib/utils/media-ref";
import { isValidTextSizeToken } from "@/lib/utils/text-size";
import { isValidYouTubeId } from "@/lib/utils/youtube";

function warnInvalidMarkdownSyntax(content: string, location: string): string[] {
  const warnings: string[] = [];
  const sizePattern = /\{size:([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = sizePattern.exec(content)) !== null) {
    if (!isValidTextSizeToken(match[1])) {
      warnings.push(
        `Invalid text size token "${match[1]}" in ${location}`
      );
    }
  }

  const youtubePattern = /youtube:\/\/([^\s)]*)/g;
  while ((match = youtubePattern.exec(content)) !== null) {
    if (!isValidYouTubeId(match[1])) {
      warnings.push(
        `Invalid YouTube video ID "${match[1]}" in ${location}`
      );
    }
  }

  return warnings;
}

export type AdminProject = {
  _id: string;
  _rev?: string;
  title: string;
  slug: string;
  shortSummary: string;
  coverImage?: {
    url: string;
    alt?: string;
    assetRef?: string;
  };
  technologies: string[];
  displayOrder: number;
  published: boolean;
  sections: Array<{
    _key: string;
    title: string;
    description?: string;
  }>;
  mediaAssets?: Array<{
    refId: string;
    alt?: string;
    caption?: string;
    url?: string;
    assetRef?: string;
  }>;
};

export type MediaAssetData = {
  refId: string;
  alt?: string;
  caption?: string;
  assetRef: string;
};

export type SaveProjectData = {
  _rev?: string;
  title: string;
  shortSummary: string;
  coverImage?: {
    _ref?: string;
    alt?: string;
  };
  displayOrder: number;
  technologies: string[];
  sections: Array<{
    _key: string;
    title: string;
    description?: string;
  }>;
  mediaAssets?: MediaAssetData[];
};

export async function getAdminProjects(): Promise<AdminProject[]> {
  const projects = await readClient.fetch<AdminProject[] | null>(
    adminProjectsQuery
  );
  return projects ?? [];
}

export async function getAdminProject(
  id: string
): Promise<AdminProject | null> {
  const project = await readClient.fetch<AdminProject | null>(
    adminProjectByIdQuery,
    { id }
  );
  return project;
}

export async function saveProjectDraft(
  id: string,
  data: SaveProjectData
): Promise<AdminProject> {
  await requireAdmin();
  const writeClient = getWriteClient();

  const patch: Record<string, unknown> = {
    title: data.title,
    shortSummary: data.shortSummary,
    displayOrder: data.displayOrder,
    technologies: data.technologies,
    sections: data.sections.map((s) => ({
      _key: s._key,
      _type: "object",
      title: s.title,
      description: s.description ?? "",
    })),
    mediaAssets: (data.mediaAssets ?? []).map((ma) => {
      if (!ASSET_REF_PATTERN.test(ma.refId)) {
        throw new Error(`Invalid media asset refId: "${ma.refId}"`);
      }
      return {
        _key: ma.refId,
        _type: "mediaAsset",
        refId: ma.refId,
        alt: ma.alt ?? "",
        ...(ma.caption !== undefined && { caption: ma.caption }),
        asset: {
          _type: "image",
          asset: { _type: "reference", _ref: ma.assetRef },
        },
      };
    }),
  };

  if (data.coverImage?._ref) {
    patch.coverImage = {
      _type: "image",
      asset: { _type: "reference", _ref: data.coverImage._ref },
      alt: data.coverImage.alt ?? "",
    };
  } else if (data.coverImage?.alt !== undefined) {
    patch["coverImage.alt"] = data.coverImage.alt;
  }

  const syntaxWarnings: string[] = [];
  if (data.shortSummary) {
    syntaxWarnings.push(...warnInvalidMarkdownSyntax(data.shortSummary, "shortSummary"));
  }
  for (const section of data.sections) {
    if (section.description) {
      syntaxWarnings.push(...warnInvalidMarkdownSyntax(section.description, `section "${section._key}"`));
    }
  }
  for (const warning of syntaxWarnings) {
    console.warn(`[saveProjectDraft] ${warning}`);
  }

  const patchBuilder = writeClient.patch(id);
  if (data._rev) {
    await patchBuilder.ifRevisionId(data._rev).set(patch).commit();
  } else {
    await patchBuilder.set(patch).commit();
  }

  const updated = await getAdminProject(id);
  if (!updated) {
    throw new Error("Failed to fetch project after save");
  }
  return updated;
}

export async function createProject(
  title: string,
  slug: string
): Promise<AdminProject> {
  await requireAdmin();
  const writeClient = getWriteClient();

  const existing = await writeClient.fetch<{ _id: string } | null>(
    `*[_type == "project" && slug.current == $slug][0]{_id}`,
    { slug }
  );
  if (existing) {
    throw new Error(`A project with slug "${slug}" already exists.`);
  }

  const doc = await writeClient.create({
    _type: "project",
    title: title.trim(),
    slug: { _type: "slug", current: slug },
    shortSummary: "",
    displayOrder: 99,
    technologies: [],
    sections: [],
    published: false,
  });

  const created = await getAdminProject(doc._id);
  if (!created) {
    throw new Error("Failed to fetch project after create");
  }
  return created;
}

export async function publishProject(id: string): Promise<AdminProject> {
  await requireAdmin();
  const writeClient = getWriteClient();
  await writeClient.patch(id).set({ published: true }).commit();

  const project = await readClient.fetch<{ slug: string } | null>(
    `*[_type == "project" && _id == $id][0]{ "slug": slug.current }`,
    { id }
  );

  revalidatePath("/");
  if (project?.slug) {
    revalidatePath(`/projects/${project.slug}`);
  }

  const updated = await getAdminProject(id);
  if (!updated) throw new Error("Failed to fetch project after publish");
  return updated;
}

export async function unpublishProject(id: string): Promise<AdminProject> {
  await requireAdmin();
  const writeClient = getWriteClient();
  await writeClient.patch(id).set({ published: false }).commit();

  const project = await readClient.fetch<{ slug: string } | null>(
    `*[_type == "project" && _id == $id][0]{ "slug": slug.current }`,
    { id }
  );

  revalidatePath("/");
  if (project?.slug) {
    revalidatePath(`/projects/${project.slug}`);
  }

  const updated = await getAdminProject(id);
  if (!updated) throw new Error("Failed to fetch project after unpublish");
  return updated;
}

export async function deleteProject(id: string): Promise<void> {
  await requireAdmin();
  const writeClient = getWriteClient();

  const project = await readClient.fetch<{ slug: string } | null>(
    `*[_type == "project" && _id == $id][0]{ "slug": slug.current }`,
    { id }
  );

  await writeClient.delete(id);

  revalidatePath("/");
  if (project?.slug) {
    revalidatePath(`/projects/${project.slug}`);
  }
}

export type UploadResult = {
  assetId: string;
  url: string;
};

export async function uploadProjectImage(
  formData: FormData
): Promise<UploadResult> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file) {
    throw new Error("No file provided");
  }

  if (!(ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new Error(
      "File type not supported. Allowed types: PNG, JPEG, WebP, GIF."
    );
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

  return {
    assetId: asset._id,
    url: asset.url,
  };
}
