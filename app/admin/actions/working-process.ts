"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/lib/sanity/write-client";
import { client as readClient } from "@/sanity/client";
import { adminWorkingProcessQuery } from "@/lib/sanity/admin-queries";
import { requireAdmin } from "@/lib/admin/auth";

export type AdminWorkingProcessStep = {
  _id: string;
  _rev?: string;
  title: string;
  description?: string;
  stepNumber: number;
  displayOrder?: number;
};

export type CreateWorkingProcessData = Omit<AdminWorkingProcessStep, "_id" | "_rev">;
export type UpdateWorkingProcessData = Partial<CreateWorkingProcessData> & { _rev?: string };

async function getStepById(id: string): Promise<AdminWorkingProcessStep | null> {
  return readClient.fetch<AdminWorkingProcessStep | null>(
    `*[_type == "workingProcess" && _id == $id][0]{ _id, _rev, title, description, stepNumber, displayOrder }`,
    { id }
  );
}

export async function getAdminWorkingProcess(): Promise<AdminWorkingProcessStep[]> {
  const result = await readClient.fetch<AdminWorkingProcessStep[] | null>(adminWorkingProcessQuery);
  return result ?? [];
}

export async function createWorkingProcessStep(data: CreateWorkingProcessData): Promise<AdminWorkingProcessStep> {
  await requireAdmin();
  const writeClient = getWriteClient();
  const doc = await writeClient.create({
    _type: "workingProcess",
    title: data.title,
    description: data.description ?? "",
    stepNumber: data.stepNumber,
    displayOrder: data.displayOrder ?? 99,
  });
  const created = await getStepById(doc._id);
  if (!created) throw new Error("Failed to fetch step after create");
  revalidatePath("/");
  return created;
}

export async function updateWorkingProcessStep(id: string, data: UpdateWorkingProcessData): Promise<AdminWorkingProcessStep> {
  await requireAdmin();
  const writeClient = getWriteClient();
  const patch: Record<string, unknown> = {
    title: data.title,
    description: data.description ?? "",
    stepNumber: data.stepNumber,
    displayOrder: data.displayOrder,
  };
  const patchBuilder = writeClient.patch(id);
  if (data._rev) {
    await patchBuilder.ifRevisionId(data._rev).set(patch).commit();
  } else {
    await patchBuilder.set(patch).commit();
  }
  const updated = await getStepById(id);
  if (!updated) throw new Error("Failed to fetch step after update");
  revalidatePath("/");
  return updated;
}

export async function deleteWorkingProcessStep(id: string): Promise<void> {
  await requireAdmin();
  const writeClient = getWriteClient();
  await writeClient.delete(id);
  revalidatePath("/");
}

export async function reorderWorkingProcessSteps(items: Array<{ _id: string; displayOrder: number }>): Promise<void> {
  await requireAdmin();
  const writeClient = getWriteClient();
  const tx = writeClient.transaction();
  for (const { _id, displayOrder } of items) {
    tx.patch(_id, (p) => p.set({ displayOrder }));
  }
  await tx.commit();
  revalidatePath("/");
}
