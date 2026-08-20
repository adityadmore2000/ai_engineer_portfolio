'use client';

import React, { useState, useEffect } from 'react';
import {
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  MessageCircle,
  Link as LinkIcon,
} from 'lucide-react';
import {
  getAdminContactSettings,
  saveContactSettings,
  type AdminContactSettings,
} from '@/app/admin/actions/contact';

export const ContactView: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [docId, setDocId] = useState<string | undefined>();
  const [docRev, setDocRev] = useState<string | undefined>();
  const [sectionDescription, setSectionDescription] = useState('');
  const [modalDescription, setModalDescription] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('');

  function hydrate(s: AdminContactSettings) {
    setDocId(s._id);
    setDocRev(s._rev);
    setSectionDescription(s.sectionDescription ?? '');
    setModalDescription(s.modalDescription ?? '');
    setCalendlyUrl(s.calendlyUrl ?? '');
  }

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        setFetchError(null);
        const data = await getAdminContactSettings();
        if (data) hydrate(data);
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : 'Failed to load contact settings');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await saveContactSettings({
        _id: docId,
        _rev: docRev,
        sectionDescription,
        modalDescription,
        calendlyUrl,
      });
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
          : e instanceof Error
          ? e.message
          : 'Failed to save'
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
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl" />
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
            <p className="text-sm font-semibold">Failed to load contact settings</p>
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Contact Settings</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              contactSettings
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage the text and scheduling link for the Let&apos;s Talk section and project discussion popup.
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
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-rose-400 hover:text-rose-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Contact Section */}
      <section className="space-y-4">
        <SectionHeading icon={MessageCircle} label="Let's Talk Section" />

        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-slate-600 font-mono uppercase tracking-wide">
            Section Description
          </label>
          <p className="text-[10px] text-slate-400 mb-1">
            Shown beneath the &ldquo;Let&apos;s Talk Now&rdquo; heading on the public contact section.
          </p>
          <textarea
            value={sectionDescription}
            onChange={(e) => setSectionDescription(e.target.value)}
            rows={3}
            placeholder="Have something you're building, exploring, or trying to solve?…"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 shadow-2xs transition-all resize-none leading-relaxed"
          />
        </div>
      </section>

      {/* Modal Section */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <SectionHeading icon={MessageCircle} label="Project Discussion Modal" />

        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-slate-600 font-mono uppercase tracking-wide">
            Modal Description
          </label>
          <p className="text-[10px] text-slate-400 mb-1">
            Shown inside the &ldquo;Discuss a Project&rdquo; popup that opens when a visitor clicks the CTA.
          </p>
          <textarea
            value={modalDescription}
            onChange={(e) => setModalDescription(e.target.value)}
            rows={4}
            placeholder="Have an AI project, a technical problem, or an idea you'd like to explore?…"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 shadow-2xs transition-all resize-none leading-relaxed"
          />
        </div>
      </section>

      {/* Scheduling Section */}
      <section className="space-y-4 pt-4 border-t border-slate-200">
        <SectionHeading icon={LinkIcon} label="Scheduling" />

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 font-mono uppercase tracking-wide mb-1">
            Calendly Booking URL
          </label>
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="url"
              value={calendlyUrl}
              onChange={(e) => setCalendlyUrl(e.target.value)}
              placeholder="https://calendly.com/yourname/30min"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 shadow-2xs transition-all"
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Activates the &ldquo;Schedule a Meeting&rdquo; button in the project discussion popup.
          </p>
        </div>
      </section>

      {!docId && (
        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          No contact settings document exists yet — saving will create one.
        </p>
      )}
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
