"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/lib/sanity/write-client";
import { client as readClient } from "@/sanity/client";
import { adminSiteSettingsQuery } from "@/lib/sanity/admin-queries";
import { requireAdmin } from "@/lib/admin/auth";

export type AdminSiteSettings = {
  _id: string;
  _rev?: string;
  email: string;
  role?: string;
  shortBio?: string;
  heroDescription?: string;
  profileImage?: {
    url: string;
    alt?: string;
    assetRef?: string;
  };
  linkedinUrl?: string;
  githubUrl?: string;
  aboutSummary?: string;
  maintenanceEnabled?: boolean;
  maintenanceMessage?: string;
  criticalLock?: boolean;
};

export type SaveSiteSettingsData = {
  _rev?: string;
  email: string;
  role?: string;
  shortBio?: string;
  heroDescription?: string;
  profileImage?: {
    _ref?: string;
    alt?: string;
  };
  linkedinUrl?: string;
  githubUrl?: string;
  aboutSummary?: string;
};

export async function getSiteSettings(): Promise<AdminSiteSettings | null> {
  return readClient.fetch<AdminSiteSettings | null>(adminSiteSettingsQuery);
}

export async function saveSiteSettings(
  id: string,
  data: SaveSiteSettingsData
): Promise<AdminSiteSettings> {
  await requireAdmin();
  const writeClient = getWriteClient();

  const patch: Record<string, unknown> = {
    email: data.email,
    role: data.role ?? "",
    shortBio: data.shortBio ?? "",
    heroDescription: data.heroDescription ?? "",
    linkedinUrl: data.linkedinUrl ?? "",
    githubUrl: data.githubUrl ?? "",
    aboutSummary: data.aboutSummary ?? "",
  };

  if (data.profileImage?._ref) {
    patch.profileImage = {
      _type: "image",
      asset: { _type: "reference", _ref: data.profileImage._ref },
      alt: data.profileImage.alt ?? "",
    };
  } else if (data.profileImage?.alt !== undefined && !data.profileImage._ref) {
    patch["profileImage.alt"] = data.profileImage.alt;
  }

  const patchBuilder = writeClient.patch(id);
  if (data._rev) {
    await patchBuilder.ifRevisionId(data._rev).set(patch).commit();
  } else {
    await patchBuilder.set(patch).commit();
  }

  const updated = await getSiteSettings();
  if (!updated) throw new Error("Failed to fetch settings after save");

  revalidatePath("/");
  return updated;
}

export async function updateSiteStateSettings(
  id: string,
  state: { maintenanceEnabled: boolean; maintenanceMessage: string; criticalLock: boolean }
): Promise<void> {
  await requireAdmin();
  const writeClient = getWriteClient();
  await writeClient.patch(id).set({
    maintenanceEnabled: state.maintenanceEnabled,
    maintenanceMessage: state.maintenanceMessage,
    criticalLock: state.criticalLock,
  }).commit();
  revalidatePath('/', 'layout');
}

export async function uploadSettingsImage(
  formData: FormData
): Promise<{ assetId: string; url: string }> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No file provided");

  const writeClient = getWriteClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const asset = await writeClient.assets.upload("image", buffer, {
    filename: file.name,
    contentType: file.type,
  });

  return { assetId: asset._id, url: asset.url };
}
