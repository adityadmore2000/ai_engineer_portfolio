"use server";

import { revalidatePath } from "next/cache";
import { getWriteClient } from "@/lib/sanity/write-client";
import { client as readClient } from "@/sanity/client";
import { requireAdmin } from "@/lib/admin/auth";

export type AdminCapability = { _id: string; _rev?: string; title: string; shortDescription: string; details?: string; useCases?: string[]; displayOrder?: number; published: boolean };
export type CapabilityData = Omit<AdminCapability, "_id" | "_rev">;
const query = `*[_type == "capability"] | order(coalesce(displayOrder, 999) asc) { _id, _rev, title, shortDescription, details, useCases, displayOrder, published }`;
async function getById(id: string) { return readClient.fetch<AdminCapability | null>(`*[_type == "capability" && _id == $id][0]{ _id, _rev, title, shortDescription, details, useCases, displayOrder, published }`, { id }); }
export async function getAdminCapabilities(): Promise<AdminCapability[]> { return (await readClient.fetch<AdminCapability[] | null>(query)) ?? []; }
export async function createCapability(data: CapabilityData): Promise<AdminCapability> {
  await requireAdmin();
  const doc = await getWriteClient().create({ _type: "capability", ...data });
  const created = await getById(doc._id);
  if (!created) throw new Error("Failed to fetch capability after create");
  revalidatePath("/"); return created;
}
export async function updateCapability(id: string, data: Partial<CapabilityData> & { _rev?: string }): Promise<AdminCapability> {
  await requireAdmin(); const client = getWriteClient(); const { _rev, ...fields } = data;
  const patch = client.patch(id);
  if (_rev) await patch.ifRevisionId(_rev).set(fields).commit(); else await patch.set(fields).commit();
  const updated = await getById(id); if (!updated) throw new Error("Failed to fetch capability after update");
  revalidatePath("/"); return updated;
}
export async function deleteCapability(id: string): Promise<void> { await requireAdmin(); await getWriteClient().delete(id); revalidatePath("/"); }
export async function reorderCapabilities(items: Array<{ _id: string; displayOrder: number }>): Promise<void> {
  await requireAdmin(); const tx = getWriteClient().transaction();
  for (const item of items) tx.patch(item._id, (patch) => patch.set({ displayOrder: item.displayOrder }));
  await tx.commit(); revalidatePath("/");
}
