"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "portfolio-site-notice-dismissed";

const CONTACT_EMAIL = "adityadmore2000@gmail.com";

function isDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function SiteNotice() {
  const [dismissed, setDismissed] = useState(isDismissed);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Ignore storage errors (e.g. private mode); notice simply won't persist.
    }
  };

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-5 py-3 md:items-center md:px-8">
        <div className="flex-1 text-sm leading-relaxed">
          <p className="font-semibold">Website update in progress</p>
          <p className="text-amber-900">
            Some information on this website may be outdated while I{"'"}m
            working on improving and updating the site. Updates may take some
            time to reflect. If you have any questions or would like to connect,
            feel free to reach me at{" "}
            <Link
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium text-amber-950 underline underline-offset-4 hover:text-amber-800"
            >
              {CONTACT_EMAIL}
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss notice"
          onClick={handleDismiss}
          className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-amber-900 transition-colors hover:bg-amber-100 hover:text-amber-950"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}