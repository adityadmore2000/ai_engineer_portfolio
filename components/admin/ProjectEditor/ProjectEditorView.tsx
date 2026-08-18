'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Save,
  Eye,
  Globe,
  CheckCircle2,
  Lock,
  Sparkles,
  Layers,
  Plus,
  BookOpen,
  Tag,
  Hash,
  ImageIcon,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  AlertTriangle,
  Images,
} from 'lucide-react';
import { usePortfolio } from '@/lib/admin/context';
import { ProjectSection } from '@/lib/admin/types';
import { TagInput } from '@/components/admin/common/TagInput';
import { ImagePickerModal } from '@/components/admin/common/ImagePickerModal';
import { MediaPickerModal, MediaInsertResult } from '@/components/admin/common/MediaPickerModal';
import { SectionCard } from './SectionCard';
import { PublishConfirmModal } from './PublishConfirmModal';
import { SECTION_TEMPLATES } from '@/lib/admin/section-templates';
import { uploadProjectImage } from '@/app/admin/actions/projects';

export const ProjectEditorView: React.FC = () => {
  const {
    activeProject,
    navigateTo,
    updateActiveProject,
    saveDraft,
    publishProject,
    discardUnsavedChanges,
    hasUnsavedChanges,
    isLoading,
    showToast,
  } = usePortfolio();

  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const [isMediaPanelOpen, setIsMediaPanelOpen] = useState(false);
  const [replacingRefId, setReplacingRefId] = useState<string | null>(null);

  const sections = useMemo(() => activeProject?.sections ?? [], [activeProject?.sections]);

  const handleReplaceMediaAsset = useCallback((refId: string, newAssetRef: string, newUrl: string) => {
    updateActiveProject((prev) => ({
      ...prev,
      mediaAssets: prev.mediaAssets.map((ma) =>
        ma.refId === refId ? { ...ma, assetRef: newAssetRef, url: newUrl } : ma
      ),
    }));
    showToast('success', 'Image replaced', 'All references will now point to the new image.');
  }, [updateActiveProject, showToast]);

  const mediaUsageCounts = useCallback((): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const section of sections) {
      const matches = section.description?.matchAll(/!\[[^\]]*\]\(asset:\/\/((?:img|vid)_[a-z0-9]{8})\)/g) ?? [];
      for (const m of matches) {
        counts[m[1]] = (counts[m[1]] ?? 0) + 1;
      }
    }
    return counts;
  }, [sections]);

  if (isLoading && !activeProject) {
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in duration-200">
        <div className="h-12 w-64 rounded-xl bg-slate-100 animate-pulse" />
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="h-5 w-40 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-10 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-40 rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="p-12 text-center space-y-4">
        <p className="text-sm text-slate-500">Project not found or selected.</p>
        <button
          onClick={() => navigateTo({ view: 'projects' })}
          className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white cursor-pointer"
        >
          Back to Projects Directory
        </button>
      </div>
    );
  }

  const handleAddSection = (initialTitle = '', initialDesc = '') => {
    const newSection: ProjectSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: initialTitle,
      description: initialDesc,
    };
    updateActiveProject({ sections: [...sections, newSection] });
    showToast('info', 'Section added', 'Fill in the section title and narrative description.');
  };

  const handleUpdateSection = (sectionId: string, updatedFields: Partial<ProjectSection>) => {
    updateActiveProject({
      sections: sections.map((s) => (s.id === sectionId ? { ...s, ...updatedFields } : s)),
    });
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    updateActiveProject({ sections: reordered });
    showToast('info', 'Section rearranged', `Moved to position ${targetIndex + 1}.`);
  };

  const handleAddMediaAsset = (asset: import('@/lib/admin/types').MediaAsset) => {
    updateActiveProject({
      mediaAssets: [...(activeProject.mediaAssets ?? []), asset],
    });
  };

  const handleDuplicateSection = (index: number) => {
    const original = sections[index];
    const duplicated: ProjectSection = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: original.title ? `${original.title} (Copy)` : 'Section Copy',
      description: original.description,
    };

    const updated = [...sections];
    updated.splice(index + 1, 0, duplicated);

    updateActiveProject({ sections: updated });
    showToast('info', 'Section duplicated');
  };

  const handleDeleteSection = (sectionId: string) => {
    updateActiveProject({ sections: sections.filter((s) => s.id !== sectionId) });
    showToast('warning', 'Section removed');
  };

  return (
    <div id="admin-project-editor-view" className="min-h-screen flex flex-col justify-between">
      {/* Main Form Content Area */}
      <div className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in duration-200">
        {/* Top Breadcrumb & Navigation Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="btn-editor-back"
              type="button"
              onClick={() => navigateTo({ view: 'projects' })}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 shadow-2xs transition-colors shrink-0 cursor-pointer"
              title="Back to Projects"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                <span
                  onClick={() => navigateTo({ view: 'projects' })}
                  className="hover:text-indigo-600 cursor-pointer"
                >
                  Projects
                </span>
                <span>/</span>
                <span className="text-slate-700 truncate">{activeProject.title || 'Untitled'}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <h1 className="text-xl font-bold text-slate-900 truncate tracking-tight">
                  {activeProject.title || 'Untitled Project'}
                </h1>
              </div>
            </div>
          </div>

          {/* Publication State Pills */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            {activeProject.published ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Published
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Draft
              </span>
            )}
          </div>
        </div>

        {/* 1. FIXED PROJECT INFORMATION */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 space-y-6 shadow-2xs">
          <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                <span>Project Information</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fixed core metadata defining the project&apos;s identity, summary, and stack.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                Order #{activeProject.displayOrder || 1}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project Title */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Project Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-project-title"
                type="text"
                value={activeProject.title}
                onChange={(e) => updateActiveProject({ title: e.target.value })}
                placeholder="e.g. Autonomous Multimodal Captioning Agent"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* Short Summary */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Short Summary <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {activeProject.shortSummary?.length || 0} characters
                </span>
              </div>
              <textarea
                id="input-project-summary"
                rows={3}
                value={activeProject.shortSummary}
                onChange={(e) => updateActiveProject({ shortSummary: e.target.value })}
                placeholder="A concise, high-impact 1-2 sentence overview explaining the problem, technologies, and outcomes..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all leading-relaxed"
              />
              <p className="text-[11px] text-slate-400">
                Displayed prominently in project cards, headers, and social previews.
              </p>
            </div>

            {/* Technologies */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>Technologies &amp; Frameworks</span>
              </label>
              <TagInput
                tags={activeProject.technologies}
                onChange={(newTags) => updateActiveProject({ technologies: newTags })}
                placeholder="Type technology name and press Enter (e.g. Python, PyTorch, Rust, CUDA)..."
              />
            </div>

            {/* Cover Image */}
            <div className="md:col-span-2 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cover Image</span> <span className="text-rose-500">*</span>
              </label>
              {activeProject.coverImage?.url ? (
                <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img
                    src={activeProject.coverImage.url}
                    alt={activeProject.coverImage.alt || 'Cover'}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setIsImagePickerOpen(true)}
                      className="opacity-0 group-hover:opacity-100 px-4 py-2 rounded-xl bg-white/90 text-xs font-semibold text-slate-800 shadow-md transition-opacity cursor-pointer"
                    >
                      Change Image
                    </button>
                  </div>
                  {activeProject.coverImage.alt && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-[10px] text-white/80 font-mono">
                      alt: {activeProject.coverImage.alt}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsImagePickerOpen(true)}
                  className="w-full h-36 border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl bg-slate-50 hover:bg-indigo-50/30 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-8 h-8 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">Click to select a cover image</span>
                </button>
              )}
            </div>

            {/* Secondary Metadata */}
            <div className="md:col-span-2 pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Locked Permalink Slug */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-500" />
                  <span>Permalink Slug</span>
                </label>
                <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-indigo-700 font-semibold truncate">
                  /projects/{activeProject.slug}
                </div>
              </div>

              {/* Display Order */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                  <Hash className="w-3 h-3 text-slate-400" />
                  <span>Display Order</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={activeProject.displayOrder || 1}
                  onChange={(e) => updateActiveProject({ displayOrder: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. DYNAMIC PROJECT SECTIONS */}
        <section className="space-y-5">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-white to-white shadow-2xs">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Project Content &amp; Narrative
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-100 text-indigo-800">
                      {sections.length} {sections.length === 1 ? 'section' : 'sections'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Structure your project narrative freely. Add sections and rearrange them in any order.
                  </p>
                </div>
              </div>
            </div>

            <button
              id="btn-add-section-top"
              type="button"
              onClick={() => handleAddSection('', '')}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Add Section</span>
            </button>
          </div>

          {/* Quick Starter Templates */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white/80 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold font-mono text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Quick Starter Suggestions</span>
              </span>
              <span className="text-[10px] text-slate-400">Click to append section</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {SECTION_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.title}
                  type="button"
                  onClick={() => handleAddSection(tmpl.title, '')}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-slate-400 group-hover:text-indigo-600" />
                  <span>{tmpl.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sections List or Empty State */}
          {sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map((section, index) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={index}
                  totalCount={sections.length}
                  mediaAssets={activeProject.mediaAssets}
                  onUpdate={(fields) => handleUpdateSection(section.id, fields)}
                  onAddMediaAsset={handleAddMediaAsset}
                  onMoveUp={() => handleMoveSection(index, 'up')}
                  onMoveDown={() => handleMoveSection(index, 'down')}
                  onDuplicate={() => handleDuplicateSection(index)}
                  onDelete={() => handleDeleteSection(section.id)}
                />
              ))}

              <button
                id="btn-add-section-bottom"
                type="button"
                onClick={() => handleAddSection('', '')}
                className="w-full py-4 border-2 border-dashed border-slate-300 hover:border-indigo-500 bg-white/60 hover:bg-indigo-50/50 rounded-2xl text-slate-600 hover:text-indigo-700 text-xs font-bold transition-all flex items-center justify-center gap-2 group cursor-pointer shadow-2xs"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-indigo-600 text-slate-600 group-hover:text-white flex items-center justify-center transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
                <span>+ Add Another Section</span>
              </button>
            </div>
          ) : (
            <div className="p-10 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-sm font-bold text-slate-900">No narrative sections yet</h3>
                <p className="text-xs text-slate-500">
                  Begin structuring this project&apos;s story by adding your first custom section. Each section only needs a title and description.
                </p>
              </div>
              <button
                id="btn-add-first-section"
                type="button"
                onClick={() => handleAddSection('', '')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Add First Section</span>
              </button>
            </div>
          )}
        </section>

        {/* 3. PROJECT MEDIA MANAGEMENT */}
        {(activeProject.mediaAssets ?? []).length > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setIsMediaPanelOpen((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                  <Images className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-slate-800">Project Media</span>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                    {(activeProject.mediaAssets ?? []).length}
                  </span>
                </div>
              </div>
              {isMediaPanelOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {isMediaPanelOpen && (() => {
              const usageCounts = mediaUsageCounts();
              return (
                <div className="border-t border-slate-100 p-5">
                  <p className="text-[11px] text-slate-400 mb-4">
                    All images attached to this project. Use <span className="font-mono bg-slate-100 px-1 rounded">Copy Reference</span> to insert a reference into any section, or <span className="font-mono bg-slate-100 px-1 rounded">Replace</span> to swap the underlying image without changing any Markdown.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(activeProject.mediaAssets ?? []).map((asset) => {
                      const count = usageCounts[asset.refId] ?? 0;
                      return (
                        <div
                          key={asset.refId}
                          className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                        >
                          <div className="aspect-video bg-slate-200 overflow-hidden">
                            <img
                              src={asset.url}
                              alt={asset.alt}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md truncate">
                                {asset.refId}
                              </span>
                              {count === 0 ? (
                                <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                                  <AlertTriangle className="w-3 h-3" />
                                  Unused
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                                  {count}×
                                </span>
                              )}
                            </div>
                            {asset.alt && (
                              <p className="text-[11px] text-slate-500 truncate">{asset.alt}</p>
                            )}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const ref = `![${asset.alt || ''}](asset://${asset.refId})`;
                                  navigator.clipboard.writeText(ref).then(() => {
                                    showToast('success', 'Reference copied', ref);
                                  });
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-600 transition-colors cursor-pointer"
                              >
                                <Copy className="w-3 h-3" />
                                Copy Ref
                              </button>
                              <button
                                type="button"
                                onClick={() => setReplacingRefId(asset.refId)}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-200 text-[11px] font-medium text-slate-600 hover:text-indigo-700 transition-colors cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Replace
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </section>
        )}
      </div>

      {/* Persistent Bottom Editorial Action Bar */}
      <div
        id="editor-bottom-action-bar"
        className="sticky bottom-0 left-0 right-0 z-30 bg-white/95 border-t border-slate-200 backdrop-blur-md px-6 py-3.5 shadow-lg"
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status & Unsaved changes indicator */}
          <div className="flex items-center gap-3 text-xs font-mono">
            {hasUnsavedChanges ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Unsaved changes
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All changes saved</span>
              </span>
            )}

            <span className="text-slate-300 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline font-mono text-[11px]">
              /projects/{activeProject.slug}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {hasUnsavedChanges && (
              <button
                id="btn-editor-discard"
                type="button"
                onClick={discardUnsavedChanges}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Discard</span>
              </button>
            )}

            <button
              id="btn-editor-save-draft"
              type="button"
              onClick={saveDraft}
              className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                hasUnsavedChanges
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400 shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 shadow-2xs'
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>

            <button
              id="btn-editor-preview"
              type="button"
              onClick={async () => {
                await saveDraft();
                navigateTo({ view: 'preview', projectId: activeProject._id });
              }}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-semibold transition-all flex items-center gap-2 border border-slate-200 shadow-2xs cursor-pointer"
              title="Open high-fidelity preview as visitors see it"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              <span>Preview</span>
            </button>

            <button
              id="btn-editor-publish"
              type="button"
              onClick={() => setIsPublishModalOpen(true)}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition-all shadow-sm shadow-emerald-200 flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Publish</span>
            </button>
          </div>
        </div>
      </div>

      {/* Publish Confirmation Modal */}
      <PublishConfirmModal
        isOpen={isPublishModalOpen}
        project={activeProject}
        onClose={() => setIsPublishModalOpen(false)}
        onConfirm={() => publishProject(activeProject._id)}
      />

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        title="Select Cover Image"
        onUpload={uploadProjectImage}
        onSelect={(url, alt, assetRef) => {
          updateActiveProject({
            coverImage: { url, alt: alt || '', _ref: assetRef },
          });
        }}
      />

      {/* Replace Media Modal */}
      <MediaPickerModal
        isOpen={replacingRefId !== null}
        onClose={() => setReplacingRefId(null)}
        mode="replace"
        mediaAssets={activeProject?.mediaAssets ?? []}
        onUpload={uploadProjectImage}
        onInsert={(result: MediaInsertResult) => {
          if (result.type === 'new' && replacingRefId) {
            handleReplaceMediaAsset(replacingRefId, result.assetRef, result.url);
          }
          setReplacingRefId(null);
        }}
      />
    </div>
  );
};
