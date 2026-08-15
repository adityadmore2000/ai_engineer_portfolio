'use client';

import React from 'react';
import { Sparkles, X, Globe, Check } from 'lucide-react';
import { Project } from '@/lib/admin/types';

interface PublishConfirmModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const PublishConfirmModal: React.FC<PublishConfirmModalProps> = ({
  isOpen,
  project,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !project) return null;

  const isAlreadyPublished = project.published;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="modal-publish-confirm"
        className="w-full max-w-lg rounded-2xl border border-indigo-100 bg-white shadow-2xl overflow-hidden text-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-indigo-50 px-6 py-4 bg-indigo-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                {isAlreadyPublished ? 'Re-publish Updates?' : 'Publish Project?'}
              </h3>
              <p className="text-xs text-indigo-700 font-medium">Make live on the public portfolio website</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-mono font-bold">You are about to publish:</p>
            <h4 className="text-lg font-bold text-slate-900 tracking-tight">&ldquo;{project.title}&rdquo;</h4>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span>Public Permalink:</span>
              <span className="font-mono text-indigo-700 font-bold">/projects/{project.slug}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Technologies:</span>
              <span className="font-mono text-slate-800 font-semibold">{project.technologies.slice(0, 3).join(', ')}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              This will update the live public website and instantly render all narrative story sections.
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-publish-action"
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Publish to Live Website</span>
          </button>
        </div>
      </div>
    </div>
  );
};
