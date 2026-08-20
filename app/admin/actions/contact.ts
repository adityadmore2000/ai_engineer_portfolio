"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/lib/sanity/write-client";
import { client as readClient } from "@/sanity/client";
import { adminContactSettingsQuery } from "@/lib/sanity/admin-queries";
import { requireAdmin } from "@/lib/admin/auth";

export type AdminContactSettings = {
  _id: string;
  _rev?: string;
  sectionDescription?: string;
  modalDescription?: string;
  calendlyUrl?: string;
};

export type SaveContactSettingsData = {
  _id?: string;
  _rev?: string;
  sectionDescription?: string;
  modalDescription?: string;
  calendlyUrl?: string;
};

export async function getAdminContactSettings(): Promise<AdminContactSettings | null> {
  return readClient.fetch<AdminContactSettings | null>(adminContactSettingsQuery);
}

export async function saveContactSettings(
  data: SaveContactSettingsData
): Promise<AdminContactSettings> {
  await requireAdmin();
  const writeClient = getWriteClient();

  const fields: Record<string, unknown> = {
    sectionDescription: data.sectionDescription ?? "",
    modalDescription: data.modalDescription ?? "",
    calendlyUrl: data.calendlyUrl ?? "",
  };

  if (data._id) {
    const patchBuilder = writeClient.patch(data._id);
    if (data._rev) {
      await patchBuilder.ifRevisionId(data._rev).set(fields).commit();
    } else {
      await patchBuilder.set(fields).commit();
    }
  } else {
    await writeClient.create({ _type: "contactSettings", ...fields });
  }

  const updated = await getAdminContactSettings();
  if (!updated) throw new Error("Failed to fetch contact settings after save");

  revalidatePath("/");
  return updated;
}
