'use client';

import React from 'react';
import { CheckCircle2, Info, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { usePortfolio } from '@/lib/admin/context';

export const Toast: React.FC = () => {
  const { toast, dismissToast } = usePortfolio();

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
    info: <Info className="w-5 h-5 text-indigo-600 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-200 bg-white/95 text-slate-900 shadow-lg shadow-emerald-500/5',
    info: 'border-indigo-200 bg-white/95 text-slate-900 shadow-lg shadow-indigo-500/5',
    warning: 'border-amber-200 bg-white/95 text-slate-900 shadow-lg shadow-amber-500/5',
    error: 'border-rose-200 bg-white/95 text-slate-900 shadow-lg shadow-rose-500/5',
  };

  return (
    <div
      id="toast-notification-banner"
      className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-200"
    >
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-xl ${
          borders[toast.type]
        }`}
      >
        {icons[toast.type]}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-tight">{toast.title}</p>
          {toast.subtitle && (
            <p className="text-xs text-slate-500 mt-1 leading-snug">{toast.subtitle}</p>
          )}
        </div>
        <button
          id="btn-toast-dismiss"
          onClick={dismissToast}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
