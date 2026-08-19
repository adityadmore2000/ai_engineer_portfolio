'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { usePortfolio } from '@/lib/admin/context';

export const AiChatCard: React.FC = () => {
  const { maintenance, updateMaintenance, showToast } = usePortfolio();

  const handleToggle = async () => {
    const next = !maintenance.showAiChat;
    try {
      await updateMaintenance({ showAiChat: next });
      showToast(
        next ? 'success' : 'info',
        next ? 'AI Chat enabled' : 'AI Chat disabled',
      );
    } catch {
      showToast('error', 'Failed to update AI Chat setting');
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
          <MessageCircle className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">AI Chat</h2>
          <p className="text-xs text-slate-500">Control the floating chat experience on the public site</p>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Show AI Chat</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Controls whether the floating AI chat button and ChatProvider are visible on the public website
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={maintenance.showAiChat}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
              maintenance.showAiChat ? 'bg-indigo-500' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                maintenance.showAiChat ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
