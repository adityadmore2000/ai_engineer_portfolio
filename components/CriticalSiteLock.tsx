"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface CriticalSiteLockProps {
  criticalLock: boolean;
  email?: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

export function CriticalSiteLock({ criticalLock, email, linkedinUrl, githubUrl }: CriticalSiteLockProps) {
  const pathname = usePathname();
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!criticalLock) setAcknowledged(false);
  }, [criticalLock]);

  useEffect(() => {
    const isAdmin = pathname.startsWith("/admin");
    if (criticalLock && !isAdmin) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [criticalLock, pathname]);

  if (!criticalLock || pathname.startsWith("/admin")) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/55">
      <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-rose-50 border-b border-rose-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-slate-900">
              Website Temporarily Unavailable
            </h2>
            <p className="text-xs text-rose-700 mt-0.5">
              Critical maintenance in progress
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-slate-700 leading-relaxed">
            This website is currently undergoing critical maintenance and is
            temporarily unavailable to visitors.
          </p>
          <p className="text-xs text-slate-500 bg-slate-50 px-3.5 py-3 rounded-xl border border-slate-100 leading-relaxed">
            Normal access will be restored once maintenance is complete. Thank
            you for your patience.
          </p>
          {(email || linkedinUrl || githubUrl) && (
            <div className="text-xs text-slate-500 bg-slate-50 px-3.5 py-3 rounded-xl border border-slate-100 space-y-1.5">
              <p className="font-medium text-slate-600">Meanwhile, you can contact me at</p>
              {email && (
                <p>
                  <span className="text-slate-400">Email: </span>
                  <a
                    href={`mailto:${email}`}
                    className="text-slate-700 hover:text-slate-900 underline underline-offset-2"
                  >
                    {email}
                  </a>
                </p>
              )}
              {linkedinUrl && (
                <p>
                  <span className="text-slate-400">LinkedIn: </span>
                  <a
                    href={linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-700 hover:text-slate-900 underline underline-offset-2"
                  >
                    {linkedinUrl}
                  </a>
                </p>
              )}
              {githubUrl && (
                <p>
                  <span className="text-slate-400">GitHub: </span>
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-700 hover:text-slate-900 underline underline-offset-2"
                  >
                    {githubUrl}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          {acknowledged && (
            <p className="text-xs text-slate-400">
              The site will be available once maintenance is complete.
            </p>
          )}
          <div className="ml-auto">
            <button
              type="button"
              onClick={() => setAcknowledged(true)}
              disabled={acknowledged}
              className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-xs font-semibold text-white transition-colors"
            >
              {acknowledged ? "Access Restricted" : "I Understand"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
