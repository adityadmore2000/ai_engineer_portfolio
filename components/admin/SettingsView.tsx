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
} from 'lucide-react';
import { MarkdownEditor } from './common/MarkdownEditor';
import {
  getSiteSettings,
  saveSiteSettings,
  uploadSettingsImage,
  type AdminSiteSettings,
  type SaveSiteSettingsData,
} from '@/app/admin/actions/settings';

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
