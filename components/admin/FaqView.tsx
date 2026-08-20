'use client';

import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { MarkdownEditor } from '@/components/admin/common/MarkdownEditor';
import {
  getAdminFaqItems,
  createFaqItem,
  updateFaqItem,
  deleteFaqItem,
  reorderFaqItems,
  type AdminFaqItem,
} from '@/app/admin/actions/faqs';

const EMPTY_FORM = { question: '', answer: '', displayOrder: '' };

export const FaqView: React.FC = () => {
  const [items, setItems] = useState<AdminFaqItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [formState, setFormState] = useState(EMPTY_FORM);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setFetchError(null);
        const data = await getAdminFaqItems();
        setItems(data);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Failed to load FAQ items');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleStartAdd = () => {
    setEditingId(null);
    setFormState(EMPTY_FORM);
    setIsAdding(true);
  };

  const handleStartEdit = (item: AdminFaqItem) => {
    setIsAdding(false);
    setEditingId(item._id);
    setFormState({
      question: item.question,
      answer: item.answer ?? '',
      displayOrder: item.displayOrder !== undefined ? String(item.displayOrder) : '',
    });
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.question.trim()) {
      showToast('error', 'Question is required.');
      return;
    }
    setIsSaving(true);
    const payload = {
      question: formState.question.trim(),
      answer: formState.answer.trim() || undefined,
      displayOrder: formState.displayOrder ? Number(formState.displayOrder) : undefined,
    };
    try {
      if (isAdding) {
        const created = await createFaqItem(payload);
        setItems((prev) => [...prev, created]);
        setIsAdding(false);
        showToast('success', 'FAQ item created.');
      } else if (editingId) {
        const current = items.find((i) => i._id === editingId);
        const updated = await updateFaqItem(editingId, { ...payload, _rev: current?._rev });
        setItems((prev) => prev.map((i) => (i._id === editingId ? updated : i)));
        setEditingId(null);
        showToast('info', 'FAQ item updated.');
      }
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteFaqItem(id);
      setItems((prev) => prev.filter((i) => i._id !== id));
      showToast('info', 'FAQ item deleted.');
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const list = [...items];
    const [moved] = list.splice(index, 1);
    list.splice(targetIdx, 0, moved);
    const reordered = list.map((item, i) => ({ ...item, displayOrder: i + 1 }));
    setItems(reordered);
    try {
      await reorderFaqItems(reordered.map((i) => ({ _id: i._id, displayOrder: i.displayOrder! })));
    } catch {
      const data = await getAdminFaqItems();
      setItems(data);
      showToast('error', 'Reorder failed.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Failed to load FAQ items</p>
            <p className="text-xs mt-0.5 font-mono">{fetchError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in duration-200">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-slate-800 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">FAQ</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Manage frequently asked questions shown on the public site.
            </p>
          </div>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={handleStartAdd}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add FAQ</span>
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {(isAdding || editingId) && (
        <section className="rounded-2xl border-2 border-indigo-200 bg-white p-6 sm:p-7 space-y-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wider">
                {isAdding ? 'New FAQ Item' : 'Edit FAQ Item'}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleCancelForm}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Question <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formState.question}
                onChange={(e) => setFormState({ ...formState, question: e.target.value })}
                placeholder="e.g. What technologies do you specialize in?"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Answer
              </label>
              <MarkdownEditor
                value={formState.answer}
                onChange={(val) => setFormState({ ...formState, answer: val })}
                placeholder="Write the answer in Markdown…"
                minHeight="120px"
              />
            </div>

            <div className="space-y-1.5 max-w-xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Display Order
              </label>
              <input
                type="number"
                min={0}
                value={formState.displayOrder}
                onChange={(e) => setFormState({ ...formState, displayOrder: e.target.value })}
                placeholder="e.g. 1"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-sm shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span className="animate-pulse">Saving…</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isAdding ? 'Create FAQ Item' : 'Save Changes'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Items List */}
      <section className="space-y-4">
        {items.length > 0 ? (
          items.map((item, index) => {
            if (editingId === item._id) return null;
            const isFirst = index === 0;
            const isLast = index === items.length - 1;

            return (
              <div
                key={item._id}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-900 leading-snug">
                      {item.question}
                    </p>
                    {item.answer && (
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {item.answer}
                      </p>
                    )}
                    {item.displayOrder !== undefined && (
                      <span className="inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                        order: {item.displayOrder}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-start">
                    <button
                      type="button"
                      onClick={() => void handleMove(index, 'up')}
                      disabled={isFirst}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMove(index, 'down')}
                      disabled={isLast}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-4 bg-slate-200 mx-0.5" />
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(item._id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-10 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-slate-900">No FAQ items yet</h3>
              <p className="text-xs text-slate-500">
                Add frequently asked questions to display on the public site.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartAdd}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Add First FAQ</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
