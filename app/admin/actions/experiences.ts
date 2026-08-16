"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/lib/sanity/write-client";
import { client as readClient } from "@/sanity/client";
import { adminExperiencesQuery } from "@/lib/sanity/admin-queries";
import { requireAdmin } from "@/lib/admin/auth";

export type AdminExperience = {
  _id: string;
  _rev?: string;
  role: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  currentRole?: boolean;
  shortDescription?: string;
  bulletPoints?: string[];
  skills?: string[];
  displayOrder?: number;
};

export type CreateExperienceData = Omit<AdminExperience, "_id" | "_rev">;
export type UpdateExperienceData = Partial<CreateExperienceData> & {
  _rev?: string;
};

async function getAdminExperienceById(
  id: string
): Promise<AdminExperience | null> {
  return readClient.fetch<AdminExperience | null>(
    `*[_type == "experience" && _id == $id][0]{
      _id, _rev, role, company, location, startDate, endDate,
      currentRole, shortDescription, bulletPoints, skills, displayOrder
    }`,
    { id }
  );
}

export async function getAdminExperiences(): Promise<AdminExperience[]> {
  const result = await readClient.fetch<AdminExperience[] | null>(
    adminExperiencesQuery
  );
  return result ?? [];
}

export async function createExperience(
  data: CreateExperienceData
): Promise<AdminExperience> {
  await requireAdmin();
  const writeClient = getWriteClient();

  const doc = await writeClient.create({
    _type: "experience",
    role: data.role,
    company: data.company,
    location: data.location,
    startDate: data.startDate,
    endDate: data.currentRole ? null : (data.endDate ?? null),
    currentRole: data.currentRole ?? false,
    shortDescription: data.shortDescription,
    bulletPoints: data.bulletPoints ?? [],
    skills: data.skills ?? [],
    displayOrder: data.displayOrder ?? 99,
  });

  const created = await getAdminExperienceById(doc._id);
  if (!created) {
    throw new Error("Failed to fetch experience after create");
  }

  revalidatePath("/");
  return created;
}

export async function updateExperience(
  id: string,
  data: UpdateExperienceData
): Promise<AdminExperience> {
  await requireAdmin();
  const writeClient = getWriteClient();

  const patch: Record<string, unknown> = {
    role: data.role,
    company: data.company,
    location: data.location,
    startDate: data.startDate,
    endDate: data.currentRole ? null : (data.endDate ?? null),
    currentRole: data.currentRole ?? false,
    shortDescription: data.shortDescription,
    bulletPoints: data.bulletPoints ?? [],
    skills: data.skills ?? [],
    displayOrder: data.displayOrder,
  };

  const patchBuilder = writeClient.patch(id);
  if (data._rev) {
    await patchBuilder.ifRevisionId(data._rev).set(patch).commit();
  } else {
    await patchBuilder.set(patch).commit();
  }

  const updated = await getAdminExperienceById(id);
  if (!updated) {
    throw new Error("Failed to fetch experience after update");
  }

  revalidatePath("/");
  return updated;
}

export async function deleteExperience(id: string): Promise<void> {
  await requireAdmin();
  const writeClient = getWriteClient();
  await writeClient.delete(id);
  revalidatePath("/");
}

export async function reorderExperiences(
  items: Array<{ _id: string; displayOrder: number }>
): Promise<void> {
  await requireAdmin();
  const writeClient = getWriteClient();

  const tx = writeClient.transaction();
  for (const { _id, displayOrder } of items) {
    tx.patch(_id, (p) => p.set({ displayOrder }));
  }
  await tx.commit();

  revalidatePath("/");
}
