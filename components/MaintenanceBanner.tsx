"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface MaintenanceBannerProps {
  enabled: boolean;
  message: string;
}

export function MaintenanceBanner({ enabled, message }: MaintenanceBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!enabled || dismissed) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-5 py-3 md:items-center md:px-8">
        <div className="flex-1 text-sm leading-relaxed">
          <p className="font-semibold">
            {message || "Website maintenance in progress"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss notice"
          onClick={() => setDismissed(true)}
          className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-amber-900 transition-colors hover:bg-amber-100 hover:text-amber-950"
        >
          <X aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}
