"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const STORAGE_KEY_MAINTENANCE = "portfolio_maintenance_v1";
const DISMISSED_KEY = "portfolio-maintenance-notice-dismissed";

interface MaintenanceData {
  enabled: boolean;
  message: string;
  criticalLock: boolean;
}

const DEFAULT_DATA: MaintenanceData = {
  enabled: false,
  message: "",
  criticalLock: false,
};

function readMaintenance(): MaintenanceData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_MAINTENANCE);
    if (stored) return { ...DEFAULT_DATA, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_DATA;
}

export function MaintenanceBanner() {
  const [data, setData] = useState<MaintenanceData>(DEFAULT_DATA);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const syncFromStorage = () => {
      setData(readMaintenance());
      try {
        setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
      } catch {}
    };

    syncFromStorage();
    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, []);

  if (!data.enabled || data.criticalLock || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
  };

  return (
    <div
      role="status"
      className="border-b border-amber-200 bg-amber-50 text-amber-950"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-5 py-3 md:items-center md:px-8">
        <div className="flex-1 text-sm leading-relaxed">
          <p className="font-semibold">
            {data.message || "Website maintenance in progress"}
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
