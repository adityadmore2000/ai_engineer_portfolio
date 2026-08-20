'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Save,
  Loader2,
  AlertCircle,
  User,
  Mail,
  Linkedin,
  Github,
  Upload,
  Image as ImageIcon,
  X,
  CheckCircle2,
  Link as LinkIcon,
  ListOrdered,
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Check,
} from 'lucide-react';
import { MarkdownEditor } from './common/MarkdownEditor';
import {
  getSiteSettings,
  saveSiteSettings,
  uploadSettingsImage,
  type AdminSiteSettings,
  type SaveSiteSettingsData,
} from '@/app/admin/actions/settings';
import {
  getAdminWorkingProcess,
  createWorkingProcessStep,
  updateWorkingProcessStep,
  deleteWorkingProcessStep,
  reorderWorkingProcessSteps,
  type AdminWorkingProcessStep,
} from '@/app/admin/actions/working-process';

export const SettingsView: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [settingsId, setSettingsId] = useState('');
  const [settingsRev, setSettingsRev] = useState<string | undefined>();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [heroDescription, setHeroDescription] = useState('');
  const [aboutSummary, setAboutSummary] = useState('');
  const [shortBio, setShortBio] = useState('');
  const [introductionVideoUrl, setIntroductionVideoUrl] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [profileImageAlt, setProfileImageAlt] = useState('');
  const [profileImageRef, setProfileImageRef] = useState<string | undefined>();

  // Working Process state
  const [steps, setSteps] = useState<AdminWorkingProcessStep[]>([]);
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [stepForm, setStepForm] = useState({ title: '', description: '', stepNumber: '' });
  const [stepError, setStepError] = useState<string | null>(null);

  function hydrate(settings: AdminSiteSettings) {
    setSettingsId(settings._id);
    setSettingsRev(settings._rev);
    setEmail(settings.email ?? '');
    setRole(settings.role ?? '');
    setLinkedinUrl(settings.linkedinUrl ?? '');
    setGithubUrl(settings.githubUrl ?? '');
    setHeroDescription(settings.heroDescription ?? '');
    setAboutSummary(settings.aboutSummary ?? '');
    setShortBio(settings.shortBio ?? '');
    setIntroductionVideoUrl(settings.introductionVideoUrl ?? '');
    setProfileImageUrl(settings.profileImage?.url ?? '');
    setProfileImageAlt(settings.profileImage?.alt ?? '');
    setProfileImageRef(settings.profileImage?.assetRef);
  }

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setFetchError(null);
        const settings = await getSiteSettings();
        if (settings) hydrate(settings);
        else setFetchError('No siteSettings document found in Sanity.');
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAdminWorkingProcess();
        setSteps(data);
      } catch {
        // silently fail; section renders empty
      }
    })();
  }, []);

  const handleStartAddStep = () => {
    setEditingStepId(null);
    setStepForm({ title: '', description: '', stepNumber: String(steps.length + 1) });
    setStepError(null);
    setIsAddingStep(true);
  };

  const handleStartEditStep = (step: AdminWorkingProcessStep) => {
    setIsAddingStep(false);
    setEditingStepId(step._id);
    setStepForm({
      title: step.title,
      description: step.description ?? '',
      stepNumber: String(step.stepNumber),
    });
    setStepError(null);
  };

  const handleCancelStepForm = () => {
    setIsAddingStep(false);
    setEditingStepId(null);
    setStepError(null);
  };

  const handleSaveStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stepForm.title.trim()) {
      setStepError('Step title is required.');
      return;
    }
    if (!stepForm.stepNumber || isNaN(Number(stepForm.stepNumber))) {
      setStepError('Step number is required.');
      return;
    }
    setIsSavingStep(true);
    setStepError(null);
    const payload = {
      title: stepForm.title.trim(),
      description: stepForm.description.trim() || undefined,
      stepNumber: Number(stepForm.stepNumber),
      displayOrder: Number(stepForm.stepNumber),
    };
    try {
      if (isAddingStep) {
        const created = await createWorkingProcessStep(payload);
        setSteps((prev) => [...prev, created].sort((a, b) => (a.stepNumber ?? 0) - (b.stepNumber ?? 0)));
        setIsAddingStep(false);
      } else if (editingStepId) {
        const current = steps.find((s) => s._id === editingStepId);
        const updated = await updateWorkingProcessStep(editingStepId, { ...payload, _rev: current?._rev });
        setSteps((prev) =>
          prev.map((s) => (s._id === editingStepId ? updated : s)).sort((a, b) => (a.stepNumber ?? 0) - (b.stepNumber ?? 0))
        );
        setEditingStepId(null);
      }
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleDeleteStep = async (id: string) => {
    try {
      await deleteWorkingProcessStep(id);
      setSteps((prev) => prev.filter((s) => s._id !== id));
    } catch (err) {
      setStepError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleMoveStep = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;
    const list = [...steps];
    const [moved] = list.splice(index, 1);
    list.splice(targetIdx, 0, moved);
    const reordered = list.map((s, i) => ({ ...s, displayOrder: i + 1, stepNumber: i + 1 }));
    setSteps(reordered);
    try {
      await reorderWorkingProcessSteps(reordered.map((s) => ({ _id: s._id, displayOrder: s.displayOrder! })));
    } catch {
      const data = await getAdminWorkingProcess();
      setSteps(data);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    setSaveError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await uploadSettingsImage(formData);
      setProfileImageUrl(result.url);
      setProfileImageRef(result.assetId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!settingsId) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const data: SaveSiteSettingsData = {
        _rev: settingsRev,
        email,
        role,
        shortBio,
        heroDescription,
        linkedinUrl,
        githubUrl,
        aboutSummary,
        introductionVideoUrl,
        profileImage: profileImageRef
          ? { _ref: profileImageRef, alt: profileImageAlt }
          : { alt: profileImageAlt },
      };
      const updated = await saveSiteSettings(settingsId, data);
      hydrate(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      const isStale =
        e instanceof Error &&
        (e.message.includes('ifRevisionId') ||
          e.message.includes('revision') ||
          (e as { statusCode?: number }).statusCode === 409);
      setSaveError(
        isStale
          ? 'Save conflict — settings were changed elsewhere. Reload to get the latest version.'
          : (e instanceof Error ? e.message : 'Failed to save settings')
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-slate-200 rounded-lg" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Failed to load settings</p>
            <p className="text-xs mt-0.5 font-mono">{fetchError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Site Settings</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              siteSettings
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage your profile and portfolio content fields.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:bg-indigo-600"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{isSaving ? 'Saving…' : saveSuccess ? 'Saved' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs flex-1">{saveError}</p>
          <button type="button" onClick={() => setSaveError(null)} className="text-rose-400 hover:text-rose-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Profile Image */}
      <section className="space-y-3">
        <SectionHeading icon={ImageIcon} label="Profile Image" />
        <div className="flex items-start gap-5 p-5 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="shrink-0">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt={profileImageAlt || 'Profile image'}
                className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                <User className="w-8 h-8 text-slate-300" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3 min-w-0">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 font-mono uppercase tracking-wide">
                Alt Text
              </label>
              <input
                type="text"
                value={profileImageAlt}
                onChange={(e) => setProfileImageAlt(e.target.value)}
                placeholder="Descriptive alt text for accessibility"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 shadow-2xs transition-all"
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploadingImage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {isUploadingImage ? 'Uploading…' : 'Upload New Image'}
            </button>
          </div>
        </div>
      </section>

      {/* Identity */}
      <section className="space-y-4">
        <SectionHeading icon={User} label="Identity" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledInput
            label="Email"
            icon={Mail}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="your@email.com"
            required
          />
          <LabeledInput
            label="Role"
            icon={User}
            type="text"
            value={role}
            onChange={setRole}
            placeholder="e.g. AI Engineer"
          />
        </div>
      </section>

      {/* Social Links */}
      <section className="space-y-4">
        <SectionHeading icon={LinkIcon} label="Social Links" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledInput
            label="LinkedIn URL"
            icon={Linkedin}
            type="url"
            value={linkedinUrl}
            onChange={setLinkedinUrl}
            placeholder="https://linkedin.com/in/…"
          />
          <LabeledInput
            label="GitHub URL"
            icon={Github}
            type="url"
            value={githubUrl}
            onChange={setGithubUrl}
            placeholder="https://github.com/…"
          />
        </div>
      </section>

      {/* Content */}
      <section className="space-y-5">
        <SectionHeading icon={Save} label="Content" />

        <div>
          <p className="text-[11px] font-semibold text-slate-600 font-mono uppercase tracking-wide mb-2">
            Summary
            <span className="ml-1.5 text-slate-400 normal-case font-normal font-sans">
              — Short bio shown in hero / about sections
            </span>
          </p>
          <MarkdownEditor
            value={shortBio}
            onChange={setShortBio}
            placeholder="Brief summary about yourself…"
            minHeight="120px"
          />
        </div>

        <div>
          <p className="text-[11px] font-semibold text-slate-600 font-mono uppercase tracking-wide mb-2">
            Hero Description
            <span className="ml-1.5 text-slate-400 normal-case font-normal font-sans">
              — Featured on the hero section
            </span>
          </p>
          <MarkdownEditor
            value={heroDescription}
            onChange={setHeroDescription}
            placeholder="Compelling description for the hero section…"
            minHeight="120px"
          />
        </div>

        <div>
          <p className="text-[11px] font-semibold text-slate-600 font-mono uppercase tracking-wide mb-2">
            About
            <span className="ml-1.5 text-slate-400 normal-case font-normal font-sans">
              — Extended about page summary
            </span>
          </p>
          <MarkdownEditor
            value={aboutSummary}
            onChange={setAboutSummary}
            placeholder="Extended about section content…"
            minHeight="160px"
          />
        </div>

        <div>
          <LabeledInput
            label="Introduction Video URL"
            icon={LinkIcon}
            type="url"
            value={introductionVideoUrl}
            onChange={setIntroductionVideoUrl}
            placeholder="https://youtube.com/watch?v=…"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            YouTube URL shown as the introduction video in the About Me section.
          </p>
        </div>

      </section>

      {/* Working Process */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <SectionHeading icon={ListOrdered} label="working-process" />
            <p className="text-[11px] text-slate-400 pl-5">
              Ordered steps shown in the Working Process section on the public site.
            </p>
          </div>
          {!isAddingStep && (
            <button
              type="button"
              onClick={handleStartAddStep}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold shadow-sm shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              Add Step
            </button>
          )}
        </div>

        {stepError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{stepError}</span>
            <button type="button" onClick={() => setStepError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Add / Edit Step Form */}
        {(isAddingStep || editingStepId) && (
          <div className="rounded-xl border-2 border-indigo-200 bg-white p-5 space-y-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider">
                  {isAddingStep ? 'New Process Step' : 'Edit Process Step'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelStepForm}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSaveStep} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600 font-mono uppercase tracking-wide">
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={stepForm.title}
                    onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })}
                    placeholder="e.g. Problem Framing"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 shadow-2xs transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600 font-mono uppercase tracking-wide">
                    Step # <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={stepForm.stepNumber}
                    onChange={(e) => setStepForm({ ...stepForm, stepNumber: e.target.value })}
                    placeholder="1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 shadow-2xs transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 font-mono uppercase tracking-wide">
                  Description
                </label>
                <MarkdownEditor
                  value={stepForm.description}
                  onChange={(val) => setStepForm({ ...stepForm, description: val })}
                  placeholder="Describe this process step…"
                  minHeight="80px"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCancelStepForm}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingStep}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSavingStep ? (
                    <span className="animate-pulse">Saving…</span>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      {isAddingStep ? 'Add Step' : 'Save'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Steps List */}
        <div className="space-y-2">
          {steps.length === 0 && !isAddingStep ? (
            <div className="p-6 rounded-xl border-2 border-dashed border-slate-200 bg-white text-center space-y-2">
              <p className="text-xs font-semibold text-slate-500">No process steps yet</p>
              <button
                type="button"
                onClick={handleStartAddStep}
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                + Add first step
              </button>
            </div>
          ) : (
            steps.map((step, index) => {
              if (editingStepId === step._id) return null;
              const isFirst = index === 0;
              const isLast = index === steps.length - 1;

              return (
                <div
                  key={step._id}
                  className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition-all"
                >
                  <span className="shrink-0 w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold font-mono border border-indigo-100">
                    {String(step.stepNumber).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{step.title}</p>
                    {step.description && (
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{step.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleMoveStep(index, 'up')}
                      disabled={isFirst}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMoveStep(index, 'down')}
                      disabled={isLast}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Move down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <div className="w-px h-3 bg-slate-200 mx-0.5" />
                    <button
                      type="button"
                      onClick={() => handleStartEditStep(step)}
                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteStep(step._id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
};

function SectionHeading({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 font-mono uppercase tracking-wider">
      <Icon className="w-3.5 h-3.5 text-indigo-500" />
      <span>{label}</span>
    </div>
  );
}

function LabeledInput({
  label,
  icon: Icon,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-600 font-mono uppercase tracking-wide">
        {label}
        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>
      <div className="relative mt-1">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 shadow-2xs transition-all"
        />
      </div>
    </div>
  );
}
