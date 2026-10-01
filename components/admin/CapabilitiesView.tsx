'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { MarkdownEditor } from '@/components/admin/common/MarkdownEditor';
import { createCapability, deleteCapability, getAdminCapabilities, reorderCapabilities, updateCapability, type AdminCapability, type CapabilityData } from '@/app/admin/actions/capabilities';

const empty: CapabilityData = { title: '', shortDescription: '', details: '', useCases: [], displayOrder: 99, published: true };
export function CapabilitiesView() {
  const [items, setItems] = useState<AdminCapability[]>([]);
  const [form, setForm] = useState<CapabilityData>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = async () => setItems(await getAdminCapabilities());
  useEffect(() => { void refresh().catch((e) => setError(e.message)); }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const normalized = { ...form, title: form.title.trim(), shortDescription: form.shortDescription.trim(), useCases: form.useCases?.filter(Boolean) };
      if (editing) await updateCapability(editing, { ...normalized, _rev: items.find((item) => item._id === editing)?._rev });
      else await createCapability(normalized);
      setForm(empty); setEditing(null); setIsAdding(false); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save capability'); } finally { setBusy(false); }
  };
  const edit = (item: AdminCapability) => { setIsAdding(false); setEditing(item._id); setForm({ title: item.title, shortDescription: item.shortDescription, details: item.details ?? '', useCases: item.useCases ?? [], displayOrder: item.displayOrder ?? 99, published: item.published }); };
  const move = async (index: number, direction: -1 | 1) => {
    const next = [...items]; const target = index + direction; if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]]; setItems(next);
    try { await reorderCapabilities(next.map((item, i) => ({ _id: item._id, displayOrder: i + 1 }))); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not reorder'); await refresh(); }
  };
  return <div className="mx-auto w-full max-w-5xl space-y-7 p-6 md:p-10">
    <header className="flex items-center justify-between border-b border-slate-200 pb-5"><div><h1 className="text-2xl font-bold text-slate-900">Capabilities</h1><p className="mt-1 text-sm text-slate-500">Describe the AI systems you build and the problems they solve.</p></div><button onClick={() => { setEditing(null); setIsAdding(true); setForm({ ...empty, displayOrder: items.length + 1 }); }} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16}/> Add capability</button></header>
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {(editing || isAdding) && <form onSubmit={save} className="space-y-4 rounded-2xl border border-indigo-200 bg-white p-5">
      <label className="block text-sm font-medium">Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5" /></label>
      <label className="block text-sm font-medium">Short description<textarea required rows={2} value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5" /></label>
      <label className="block text-sm font-medium">Expanded details<MarkdownEditor value={form.details ?? ''} onChange={(details) => setForm({ ...form, details })} placeholder="Explain the system and outcomes it enables…" minHeight="120px" /></label>
      <label className="block text-sm font-medium">Problems / use cases (one per line)<textarea rows={3} value={(form.useCases ?? []).join('\n')} onChange={(e) => setForm({ ...form, useCases: e.target.value.split('\n') })} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5" /></label>
      <div className="flex flex-wrap items-center gap-4"><label className="text-sm">Order<input type="number" min={0} value={form.displayOrder ?? 0} onChange={(e) => setForm({ ...form, displayOrder: Number(e.target.value) })} className="ml-2 w-20 rounded-lg border border-slate-200 p-2" /></label><label className="text-sm"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="mr-2"/>Published</label><button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{busy ? 'Saving…' : editing ? 'Save changes' : 'Create capability'}</button><button type="button" onClick={() => { setEditing(null); setIsAdding(false); setForm(empty); }} className="text-sm text-slate-500">Cancel</button></div>
    </form>}
    <div className="space-y-3">{items.map((item, index) => <article key={item._id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5"><div><h2 className="font-semibold text-slate-900">{item.title} {!item.published && <span className="text-xs font-normal text-amber-700">· Disabled</span>}</h2><p className="mt-1 text-sm text-slate-500">{item.shortDescription}</p></div><div className="flex shrink-0 items-center gap-1"><button aria-label="Move up" disabled={!index} onClick={() => void move(index, -1)} className="p-2 disabled:opacity-30"><ArrowUp size={16}/></button><button aria-label="Move down" disabled={index === items.length - 1} onClick={() => void move(index, 1)} className="p-2 disabled:opacity-30"><ArrowDown size={16}/></button><button onClick={() => edit(item)} className="px-2 text-sm text-indigo-700">Edit</button><button aria-label={`Delete ${item.title}`} onClick={() => void deleteCapability(item._id).then(refresh).catch((e) => setError(e.message))} className="p-2 text-rose-600"><Trash2 size={16}/></button></div></article>)}</div>
  </div>;
}
