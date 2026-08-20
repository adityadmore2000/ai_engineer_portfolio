"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/lib/sanity/write-client";
import { client as readClient } from "@/sanity/client";
import { adminFaqItemsQuery } from "@/lib/sanity/admin-queries";
import { requireAdmin } from "@/lib/admin/auth";

export type AdminFaqItem = {
  _id: string;
  _rev?: string;
  question: string;
  answer?: string;
  displayOrder?: number;
};

export type CreateFaqItemData = Omit<AdminFaqItem, "_id" | "_rev">;
export type UpdateFaqItemData = Partial<CreateFaqItemData> & { _rev?: string };

async function getFaqById(id: string): Promise<AdminFaqItem | null> {
  return readClient.fetch<AdminFaqItem | null>(
    `*[_type == "faqItem" && _id == $id][0]{ _id, _rev, question, answer, displayOrder }`,
    { id }
  );
}

export async function getAdminFaqItems(): Promise<AdminFaqItem[]> {
  const result = await readClient.fetch<AdminFaqItem[] | null>(adminFaqItemsQuery);
  return result ?? [];
}

export async function createFaqItem(data: CreateFaqItemData): Promise<AdminFaqItem> {
  await requireAdmin();
  const writeClient = getWriteClient();
  const doc = await writeClient.create({
    _type: "faqItem",
    question: data.question,
    answer: data.answer ?? "",
    displayOrder: data.displayOrder ?? 99,
  });
  const created = await getFaqById(doc._id);
  if (!created) throw new Error("Failed to fetch FAQ after create");
  revalidatePath("/");
  return created;
}

export async function updateFaqItem(id: string, data: UpdateFaqItemData): Promise<AdminFaqItem> {
  await requireAdmin();
  const writeClient = getWriteClient();
  const patch: Record<string, unknown> = {
    question: data.question,
    answer: data.answer ?? "",
    displayOrder: data.displayOrder,
  };
  const patchBuilder = writeClient.patch(id);
  if (data._rev) {
    await patchBuilder.ifRevisionId(data._rev).set(patch).commit();
  } else {
    await patchBuilder.set(patch).commit();
  }
  const updated = await getFaqById(id);
  if (!updated) throw new Error("Failed to fetch FAQ after update");
  revalidatePath("/");
  return updated;
}

export async function deleteFaqItem(id: string): Promise<void> {
  await requireAdmin();
  const writeClient = getWriteClient();
  await writeClient.delete(id);
  revalidatePath("/");
}

export async function reorderFaqItems(items: Array<{ _id: string; displayOrder: number }>): Promise<void> {
  await requireAdmin();
  const writeClient = getWriteClient();
  const tx = writeClient.transaction();
  for (const { _id, displayOrder } of items) {
    tx.patch(_id, (p) => p.set({ displayOrder }));
  }
  await tx.commit();
  revalidatePath("/");
}
