'use client';

import React from 'react';
import { Archive, X, Check } from 'lucide-react';
import { Project } from '@/lib/admin/types';

interface ArchiveConfirmModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export const ArchiveConfirmModal: React.FC<ArchiveConfirmModalProps> = ({
  isOpen,
  project,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="modal-archive-confirm"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden text-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-amber-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Archive Project?</h3>
              <p className="text-xs text-slate-500">Move out of active catalog</p>
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
        <div className="p-6 space-y-3">
          <p className="text-sm text-slate-700 leading-relaxed">
            Are you sure you want to archive <strong className="text-slate-900 font-bold">&ldquo;{project.title}&rdquo;</strong>?
          </p>
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            The project will no longer appear on your active portfolio listings, but its content and draft history will be preserved in your Archived filter. You can restore it at any time.
          </p>
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
            type="button"
            onClick={() => {
              onConfirm(project._id);
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archive Project</span>
          </button>
        </div>
      </div>
    </div>
  );
};
