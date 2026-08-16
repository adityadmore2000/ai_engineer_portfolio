'use client';

import React, { useState, useEffect } from 'react';
import { X, Sparkles, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { usePortfolio } from '@/lib/admin/context';
import { slugify } from '@/lib/admin/utils/slugify';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
  const { createProject, navigateTo, projects } = usePortfolio();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSlug('');
      setIsSlugManuallyEdited(false);
      setError('');
    }
  }, [isOpen]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!isSlugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    setSlug(slugify(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a project title.');
      return;
    }
    const finalSlug = slug.trim() || slugify(title);
    if (!finalSlug) {
      setError('Please provide a valid slug.');
      return;
    }

    const exists = projects.some((p) => p.slug.toLowerCase() === finalSlug.toLowerCase());
    if (exists) {
      setError('A project with this slug already exists. Please choose a unique slug.');
      return;
    }

    try {
      const created = await createProject(title, finalSlug);
      onClose();
      navigateTo({ view: 'project_edit', projectId: created._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="modal-create-project"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden text-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Create New Project</h3>
              <p className="text-xs text-slate-500">Set initial project title and permanent URL slug</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Title input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Project Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={handleTitleChange}
              placeholder="e.g. Agentic Video Captioning Pipeline"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
            />
          </div>

          {/* Slug input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                URL Slug <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                /projects/<span className="text-indigo-600 font-bold">{slug || 'your-slug'}</span>
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                value={slug}
                onChange={handleSlugChange}
                placeholder="agentic-video-captioning"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-indigo-700 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              />
            </div>

            {/* Immutability warning note */}
            <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
              <Lock className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900">Immutable URL Identifier</p>
                <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
                  The slug is editable right now, but will become <strong>permanently locked</strong> once the project is created to preserve permalinks and canonical indexing.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-create-project"
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>Create &amp; Open Editor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
