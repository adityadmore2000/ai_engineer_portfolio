'use client';

import React, { useState, useEffect } from 'react';
import { Wrench, ShieldAlert, Lock, Check } from 'lucide-react';
import { usePortfolio } from '@/lib/admin/context';
import { CriticalLockConfirmModal } from './CriticalLockConfirmModal';

export const MaintenanceCard: React.FC = () => {
  const { maintenance, updateMaintenance, showToast } = usePortfolio();
  const [localMessage, setLocalMessage] = useState(maintenance.message);
  const [isDirty, setIsDirty] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);

  // Sync local message with context on hydration (first localStorage read)
  useEffect(() => {
    if (!isDirty) {
      setLocalMessage(maintenance.message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintenance.message]);

  const handleToggleNotice = () => {
    const next = !maintenance.enabled;
    updateMaintenance({ enabled: next });
    showToast(
      next ? 'warning' : 'info',
      next ? 'Maintenance notice enabled' : 'Maintenance notice disabled',
    );
  };

  const handleSaveMessage = () => {
    updateMaintenance({ message: localMessage });
    setIsDirty(false);
    showToast('success', 'Maintenance message saved');
  };

  const handleDiscard = () => {
    setLocalMessage(maintenance.message);
    setIsDirty(false);
  };

  const handleEnableLock = () => {
    updateMaintenance({ criticalLock: true });
    showToast('warning', 'Critical site lock enabled', 'Public website is now inaccessible.');
  };

  const handleDisableLock = () => {
    updateMaintenance({ criticalLock: false });
    showToast('success', 'Critical site lock disabled', 'Public website is now accessible.');
  };

  return (
    <>
      <CriticalLockConfirmModal
        isOpen={showLockConfirm}
        onClose={() => setShowLockConfirm(false)}
        onConfirm={handleEnableLock}
      />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Maintenance</h2>
            <p className="text-xs text-slate-500">Control public site availability and notices</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {/* Maintenance Notice Section */}
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Maintenance Notice</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Shows a non-blocking amber banner on the public website
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={maintenance.enabled}
                onClick={handleToggleNotice}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  maintenance.enabled ? 'bg-amber-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    maintenance.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Notice Message */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-mono">
                Notice Message
              </label>
              <textarea
                value={localMessage}
                onChange={(e) => {
                  setLocalMessage(e.target.value);
                  setIsDirty(e.target.value !== maintenance.message);
                }}
                rows={2}
                placeholder="Website update in progress..."
                className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-300 placeholder:text-slate-400 transition-colors"
              />
              {isDirty && (
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMessage}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors shadow-xs"
                  >
                    <Check className="w-3 h-3" />
                    Save Message
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Critical Site Lock Section */}
          <div className={`px-6 py-5 transition-colors ${maintenance.criticalLock ? 'bg-rose-50/40' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                    maintenance.criticalLock
                      ? 'bg-rose-100 border-rose-200 text-rose-600'
                      : 'bg-slate-100 border-slate-200 text-slate-500'
                  }`}
                >
                  {maintenance.criticalLock ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800">Critical Site Lock</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Completely blocks the public website for all visitors
                  </p>
                  {maintenance.criticalLock && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
                      <span className="text-xs font-semibold text-rose-700 font-mono">
                        LOCK ACTIVE — Site is inaccessible
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={
                  maintenance.criticalLock
                    ? handleDisableLock
                    : () => setShowLockConfirm(true)
                }
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                  maintenance.criticalLock
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {maintenance.criticalLock ? 'Disable Lock' : 'Enable Lock'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
