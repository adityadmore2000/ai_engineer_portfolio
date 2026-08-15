'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { Project } from '@/lib/admin/types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  project,
  onClose,
  onConfirm,
}) => {
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
    }
  }, [isOpen]);

  if (!isOpen || !project) return null;

  const isMatch = confirmInput.trim().toLowerCase() === project.title.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="modal-delete-confirm"
        className="w-full max-w-md rounded-2xl border border-rose-200 bg-white shadow-2xl overflow-hidden text-slate-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-100 px-6 py-4 bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Delete Project?</h3>
              <p className="text-xs text-rose-600 font-medium">Permanent destructive action</p>
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
          <p className="text-sm text-slate-700 leading-relaxed">
            You are about to permanently delete{' '}
            <strong className="text-slate-900 font-bold">&ldquo;{project.title}&rdquo;</strong>. All associated story sections, metrics, and media configurations will be purged.
          </p>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-mono">
            <p className="text-slate-400 uppercase text-[10px] tracking-wider mb-1 font-bold">Target Slug</p>
            <p className="text-indigo-700 font-bold">/projects/{project.slug}</p>
          </div>

          <div className="space-y-2 pt-2">
            <label className="block text-xs font-bold text-slate-700">
              Type the project title <span className="font-mono text-rose-700 font-bold">&ldquo;{project.title}&rdquo;</span> to confirm:
            </label>
            <input
              type="text"
              autoFocus
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={project.title}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-rose-500 focus:bg-white focus:ring-1 focus:ring-rose-500 font-medium transition-all"
            />
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
            type="button"
            disabled={!isMatch}
            onClick={() => {
              onConfirm(project._id);
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Permanently</span>
          </button>
        </div>
      </div>
    </div>
  );
};
