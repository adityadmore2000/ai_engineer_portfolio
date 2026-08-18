'use client';

import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Building2,
  Calendar,
  MapPin,
  FileText,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Check,
  X,
  Sparkles,
  List,
} from 'lucide-react';
import { usePortfolio } from '@/lib/admin/context';
import { Experience } from '@/lib/admin/types';
import { Markdown } from '@/components/Markdown';
import { MarkdownEditor } from '@/components/admin/common/MarkdownEditor';
import { TagInput } from '@/components/admin/common/TagInput';

function formatDuration(
  startDate?: string,
  endDate?: string,
  currentRole?: boolean
): string {
  if (!startDate && !currentRole) return '';
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(
      new Date(d + 'T00:00:00')
    );
  const start = startDate ? fmt(startDate) : '';
  const end = currentRole ? 'Present' : endDate ? fmt(endDate) : '';
  if (!start && !end) return '';
  if (!start) return end;
  if (!end) return start;
  return `${start} – ${end}`;
}

const EMPTY_FORM = {
  company: '',
  role: '',
  startDate: '',
  endDate: '',
  currentRole: false,
  location: '',
  shortDescription: '',
  bulletPoints: [] as string[],
  skills: [] as string[],
};

export const ExperienceView: React.FC = () => {
  const {
    experiences,
    createExperience,
    updateExperience,
    deleteExperience,
    reorderExperiences,
    showToast,
  } = usePortfolio();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);

  const handleStartAdd = () => {
    setEditingId(null);
    setFormState({
      ...EMPTY_FORM,
      shortDescription: `* Built and scaled core platform services with high reliability.\n* Collaborated across engineering teams to ship major architectural upgrades.\n* Optimized system performance and reduced latency across key workflows.`,
    });
    setIsAdding(true);
  };

  const handleStartEdit = (exp: Experience) => {
    setIsAdding(false);
    setEditingId(exp._id);
    setFormState({
      company: exp.company,
      role: exp.role,
      startDate: exp.startDate ?? '',
      endDate: exp.endDate ?? '',
      currentRole: exp.currentRole ?? false,
      location: exp.location ?? '',
      shortDescription: exp.shortDescription ?? '',
      bulletPoints: exp.bulletPoints ?? [],
      skills: exp.skills ?? [],
    });
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.company.trim() || !formState.role.trim()) {
      showToast('error', 'Required fields missing', 'Please provide both Company Name and Role.');
      return;
    }

    setIsSaving(true);
    const payload = {
      company: formState.company.trim(),
      role: formState.role.trim(),
      location: formState.location.trim() || undefined,
      startDate: formState.startDate || undefined,
      endDate: formState.currentRole ? undefined : (formState.endDate || undefined),
      currentRole: formState.currentRole,
      shortDescription: formState.shortDescription.trim() || undefined,
      bulletPoints: formState.bulletPoints.map((b) => b.trim()).filter(Boolean),
      skills: formState.skills,
    };

    try {
      if (isAdding) {
        await createExperience(payload);
        setIsAdding(false);
      } else if (editingId) {
        const currentExp = experiences.find((e) => e._id === editingId);
        await updateExperience(editingId, { ...payload, _rev: currentExp?._rev });
        setEditingId(null);
      }
    } catch {
      // error toast already shown by context
    } finally {
      setIsSaving(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= experiences.length) return;

    const list = [...experiences];
    const [moved] = list.splice(index, 1);
    list.splice(targetIdx, 0, moved);
    await reorderExperiences(list);
    showToast('info', 'Experience reordered');
  };

  return (
    <div id="admin-experience-view" className="p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Experience
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {experiences.length} {experiences.length === 1 ? 'position' : 'positions'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Manage your career history with clean, minimal role cards and Markdown bullet points.
              </p>
            </div>
          </div>
        </div>

        {!isAdding && (
          <button
            id="btn-add-experience"
            type="button"
            onClick={handleStartAdd}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add Experience</span>
          </button>
        )}
      </div>

      {/* Add / Edit Form */}
      {(isAdding || editingId) && (
        <section
          id="experience-editor-form-card"
          className="rounded-2xl border-2 border-indigo-200 bg-white p-6 sm:p-7 space-y-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 font-mono uppercase tracking-wider">
                {isAdding ? 'New Experience Position' : 'Edit Experience Position'}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleCancelForm}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Row 1: Company Name + Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Company Name <span className="text-rose-500">*</span></span>
                </label>
                <input
                  id="input-exp-company"
                  type="text"
                  required
                  value={formState.company}
                  onChange={(e) => setFormState({ ...formState, company: e.target.value })}
                  placeholder="e.g. Anthropic, Stripe, Google, or Vercel"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Role <span className="text-rose-500">*</span></span>
                </label>
                <input
                  id="input-exp-role"
                  type="text"
                  required
                  value={formState.role}
                  onChange={(e) => setFormState({ ...formState, role: e.target.value })}
                  placeholder="e.g. Senior Software Engineer, Staff AI Engineer"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Row 2: Start Date + Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Start Date</span>
                </label>
                <input
                  id="input-exp-start-date"
                  type="date"
                  value={formState.startDate}
                  onChange={(e) => setFormState({ ...formState, startDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Location</span>
                </label>
                <input
                  id="input-exp-location"
                  type="text"
                  value={formState.location}
                  onChange={(e) => setFormState({ ...formState, location: e.target.value })}
                  placeholder="e.g. San Francisco, CA (Hybrid) or Remote"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Row 3: Currently working here + End Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex items-center gap-3 pt-1">
                <input
                  id="input-exp-current-role"
                  type="checkbox"
                  checked={formState.currentRole}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      currentRole: e.target.checked,
                      endDate: e.target.checked ? '' : formState.endDate,
                    })
                  }
                  className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                />
                <label
                  htmlFor="input-exp-current-role"
                  className="text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer select-none"
                >
                  Currently working here
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>End Date</span>
                </label>
                <input
                  id="input-exp-end-date"
                  type="date"
                  value={formState.endDate}
                  onChange={(e) => setFormState({ ...formState, endDate: e.target.value })}
                  disabled={formState.currentRole}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Short Description (Markdown) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Short Description (Markdown)</span>
                </label>
              </div>
              <MarkdownEditor
                value={formState.shortDescription}
                onChange={(val) => setFormState({ ...formState, shortDescription: val })}
                placeholder="A brief summary of the role and impact..."
                minHeight="100px"
              />
            </div>

            {/* Bullet Points */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <List className="w-3.5 h-3.5 text-indigo-600" />
                <span>Bullet Points</span>
              </label>
              <div className="space-y-2">
                {formState.bulletPoints.map((pt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pt}
                      onChange={(e) => {
                        const updated = [...formState.bulletPoints];
                        updated[i] = e.target.value;
                        setFormState({ ...formState, bulletPoints: updated });
                      }}
                      placeholder="e.g. Reduced p99 latency by 40% across 3 services"
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormState({
                          ...formState,
                          bulletPoints: formState.bulletPoints.filter((_, j) => j !== i),
                        })
                      }
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                      title="Remove bullet"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setFormState({ ...formState, bulletPoints: [...formState.bulletPoints, ''] })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Bullet Point
                </button>
              </div>
            </div>

            {/* Skills & Tags */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Skills &amp; Tags</span>
              </label>
              <TagInput
                tags={formState.skills}
                onChange={(skills) => setFormState({ ...formState, skills })}
                placeholder="Add skill or tag..."
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-save-experience"
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-sm shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span className="animate-pulse">Saving…</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{isAdding ? 'Create Position' : 'Save Changes'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Experience Positions List */}
      <section className="space-y-4">
        {experiences.length > 0 ? (
          experiences.map((exp, index) => {
            const isCurrentlyEditing = editingId === exp._id;
            if (isCurrentlyEditing) return null;

            const isFirst = index === 0;
            const isLast = index === experiences.length - 1;
            const duration = formatDuration(exp.startDate, exp.endDate, exp.currentRole);

            return (
              <div
                key={exp._id}
                id={`experience-card-${exp._id}`}
                className="group relative rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  {/* Left: Role, Company, Location, Duration */}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                        {exp.role}
                      </h3>
                      <span className="text-slate-300 hidden sm:inline">•</span>
                      <span className="text-sm font-semibold text-indigo-600 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {exp.company}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono pt-0.5">
                      {duration && (
                        <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-0.5 rounded-md text-slate-700 font-medium border border-slate-200">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {duration}
                        </span>
                      )}
                      {exp.location && (
                        <span className="flex items-center gap-1 text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {exp.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
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
                      onClick={() => handleStartEdit(exp)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit experience"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => void deleteExperience(exp._id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete experience"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Short Description */}
                {exp.shortDescription && (
                  <div className="pt-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <Markdown>{exp.shortDescription}</Markdown>
                  </div>
                )}

                {/* Bullet Points */}
                {exp.bulletPoints && exp.bulletPoints.length > 0 && (
                  <ul className="mt-3 space-y-1 list-disc pl-5 text-xs text-slate-700">
                    {exp.bulletPoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                )}

                {/* Skills */}
                {exp.skills && exp.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {exp.skills.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          /* Empty State */
          <div className="p-10 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
              <Briefcase className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-slate-900">No experience records added yet</h3>
              <p className="text-xs text-slate-500">
                Add your career history positions with company names, roles, dates, locations, and bullet points.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStartAdd}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-200 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Add First Position</span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
